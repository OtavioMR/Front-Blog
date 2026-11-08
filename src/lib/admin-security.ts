import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type Session = { token: string; refreshToken?: string; tokenExpires: number; csrf: string; expires: number; idleExpires: number; revoked: boolean; timer?: ReturnType<typeof setTimeout>; refreshing?: Promise<boolean>; usedConfirmations: Set<string> };
const state = globalThis as typeof globalThis & { __editorialSessions?: Map<string, Session> };
const sessions = state.__editorialSessions ??= new Map();
function removeSession(key: string) {
  const session = sessions.get(key);
  if (session) { session.revoked = true; session.refreshToken = undefined; if (session.timer) clearTimeout(session.timer); }
  sessions.delete(key);
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomSecret = () => randomBytes(32).toString("base64url");
export const cookieName = process.env.NODE_ENV === "production" ? "__Host-editorial-session" : "editorial-session-dev";
export const loginCookieName = process.env.NODE_ENV === "production" ? "__Host-editorial-login" : "editorial-login-dev";
export function sameSecret(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || !/^[A-Za-z0-9_-]{43}$/.test(a) || !/^[A-Za-z0-9_-]{43}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function allowedOrigin(value: string | null): boolean {
  try {
    const site = new URL(process.env.SITE_ORIGIN || "http://localhost:3000");
    return ["http:", "https:"].includes(site.protocol) && (process.env.NODE_ENV !== "production" || site.protocol === "https:") && !site.username && !site.password && site.pathname === "/" && !site.search && !site.hash && value === site.origin;
  } catch { return false; }
}
const duration = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= 60 && value <= 604800 ? value * 1000 : fallback;
};
export function refreshCookie(response: Response): string | null {
  const headers = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  for (const header of headers) {
    const match = /^refreshToken=([A-Za-z0-9._-]+)(?:;|$)/.exec(header);
    if (match) return match[1];
  }
  return null;
}
export function createSession(token: string, seconds: number, refreshToken?: string) {
  for (const [key, session] of sessions) if (session.expires <= Date.now() || session.idleExpires <= Date.now()) removeSession(key);
  if (sessions.size >= 1000) throw new Error("capacity");
  const id = randomSecret();
  if (seconds <= 10 || !Number.isFinite(seconds)) throw new Error("expired");
  const now = Date.now();
  const session: Session = { token, refreshToken, tokenExpires: now + (seconds - 10) * 1000, csrf: randomSecret(), expires: now + (refreshToken ? duration("ADMIN_SESSION_MAX_SECONDS", 12 * 60 * 60 * 1000) : Math.min(300, seconds - 10) * 1000), idleExpires: now + duration("ADMIN_SESSION_IDLE_SECONDS", 2 * 60 * 60 * 1000), revoked: false, usedConfirmations: new Set() };
  const key = hash(id);
  sessions.set(key, session);
  session.timer = setTimeout(() => { if (sessions.get(key) === session) removeSession(key); }, session.expires - Date.now());
  session.timer.unref();
  return { id, session };
}
export function getSession(id?: string): Session | null {
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const key = hash(id); const value = sessions.get(key);
  if (!value || value.revoked || value.expires <= Date.now() || value.idleExpires <= Date.now()) { removeSession(key); return null; }
  return value;
}
export function deleteSession(id?: string) { if (id) removeSession(hash(id)); }
export async function getValidSession(id?: string): Promise<Session | null> {
  const session = getSession(id);
  if (!session) return null;
  if (session.tokenExpires <= Date.now()) {
    if (!session.refreshToken) { deleteSession(id); return null; }
    session.refreshing ??= (async () => {
      const response = await upstream("/auth/refresh", { method: "POST", headers: { Cookie: `refreshToken=${session.refreshToken}` } });
      if (response.status === 401 || response.status === 403) return false;
      if (!response.ok) throw new Error("refresh unavailable");
      const next = refreshCookie(response);
      const payload: unknown = await response.json();
      if (!next || !payload || typeof payload !== "object" || !("access_token" in payload) || typeof payload.access_token !== "string" || !payload.access_token || !("expires_in" in payload) || typeof payload.expires_in !== "number" || !Number.isFinite(payload.expires_in) || payload.expires_in <= 10) throw new Error("invalid refresh response");
      if (session.revoked) return false;
      session.token = payload.access_token;
      session.refreshToken = next;
      session.tokenExpires = Date.now() + (payload.expires_in - 10) * 1000;
      return true;
    })().finally(() => { session.refreshing = undefined; });
    let refreshed: boolean;
    try { refreshed = await session.refreshing; } catch (error) { deleteSession(id); throw error; }
    if (!refreshed) { deleteSession(id); return null; }
  }
  if (!getSession(id)) return null;
  session.idleExpires = Date.now() + duration("ADMIN_SESSION_IDLE_SECONDS", 2 * 60 * 60 * 1000);
  return session;
}
// Apenas leituras seguras devem ser repetidas após um 401 inesperado. Uma
// rotação já concluída por outra requisição é reutilizada, sem renovar de novo.
export async function refreshAfterUnauthorized(id: string | undefined, rejectedToken: string): Promise<Session | null> {
  const session = getSession(id);
  if (!session) return null;
  if (session.token === rejectedToken) session.tokenExpires = 0;
  return getValidSession(id);
}
export type AdminActorInfo = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
  name?: string;
  email?: string;
  profilePhoto?: string | null;
  totpEnabled?: boolean;
};

// O sub apenas seleciona o perfil; o Nest valida o token e fornece a role atual.
export async function adminActor(token: string): Promise<AdminActorInfo | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1].length > 4096) return null;
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || !("sub" in payload) || typeof payload.sub !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) return null;
    const response = await upstream(`/users/${payload.sub}`, { headers: { Authorization: `Bearer ${token}` } });
    if ([401, 403, 404].includes(response.status)) return null;
    if (!response.ok) throw new Error("admin identity unavailable");
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("id" in value) || value.id !== payload.sub || !("role" in value) || (value.role !== "ADMIN" && value.role !== "SUPER_ADMIN")) return null;
    const name = "name" in value && typeof value.name === "string" ? value.name : undefined;
    const email = "email" in value && typeof value.email === "string" ? value.email : undefined;
    const profilePhoto = "profilePhoto" in value && (typeof value.profilePhoto === "string" || value.profilePhoto === null) ? value.profilePhoto : null;
    const totpEnabled = "totpEnabled" in value && typeof value.totpEnabled === "boolean" ? value.totpEnabled : undefined;
    return { id: payload.sub, role: value.role, name, email, profilePhoto, totpEnabled };
  } catch { throw new Error("admin identity unavailable"); }
}
export function consumeConfirmation(session: Session, signature: string): boolean {
  if (session.usedConfirmations.size >= 1000 || session.usedConfirmations.has(signature)) return false;
  session.usedConfirmations.add(signature);
  return true;
}

export async function upstream(path: string, init: RequestInit = {}): Promise<Response> {
  const origin = process.env.API_ORIGIN || "http://localhost:3001";
  return fetch(`${origin}/api/v1${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
}
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow", "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" };
export function page(title: string, body: string, status = 200) { return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{font:16px system-ui;max-width:70rem;margin:3rem auto;padding:0 1rem;color:#243a31;background:#fff;overflow-wrap:anywhere}article{border-top:1px solid #ccd5cc;padding:1rem 0}input,button,textarea,select{font:inherit;max-width:100%;padding:.65rem;margin:.4rem 0}label{display:block}button{cursor:pointer}a:focus-visible,input:focus-visible,button:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #185a3d;outline-offset:3px}form.inline{display:inline-block;margin-right:1rem}</style><main><h1>${escapeHtml(title)}</h1>${body}</main></html>`, { status, headers }); }
export async function formBody(request: Request): Promise<URLSearchParams | null> {
  if (!allowedOrigin(request.headers.get("origin")) || !/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get("content-type") || "")) return null;
  const rawLength = request.headers.get("content-length");
  if (rawLength !== null && (!/^\d+$/.test(rawLength) || Number(rawLength) > 8192)) return null;
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}
