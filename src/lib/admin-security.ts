import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { createStoredSession, deleteStoredSession, readStoredSession, withStoredSession } from "./admin-session-store.ts";

type RefreshState = { sessionId: string; generation: number; cookies: Record<string, string>; operation?: { id: string; generation: number } };
type Session = { key: string; token: string; refresh?: RefreshState; tokenExpires: number; csrf: string; expires: number; idleExpires: number; usedConfirmations: string[] };
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
function sessionCookies(response: Response, sessionId: string, generation: number): Record<string, string> {
  const prefix = process.env.NODE_ENV === "production" ? "__Secure-griforio" : "griforio-dev";
  const names = [`${prefix}-rt-${sessionId}-${generation}`, `${prefix}-proof-${sessionId}-${generation}`];
  const result: Record<string, string> = {};
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index), value = pair.slice(index + 1);
    if (names.includes(name) && /^[A-Za-z0-9._-]+$/.test(value) && /;\s*HttpOnly(?:;|$)/i.test(header)
      && (process.env.NODE_ENV !== "production" || /;\s*Secure(?:;|$)/i.test(header))) result[name] = value;
  }
  if (names.some(name => !result[name])) throw new Error("missing v2 session cookies");
  return result;
}
export function loginRefreshState(response: Response, payload: Record<string, unknown>): RefreshState {
  if (payload.refresh_protocol !== 2 || typeof payload.session_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.session_id) || payload.refresh_generation !== 0) throw new Error("invalid v2 login");
  return { sessionId: payload.session_id, generation: 0, cookies: sessionCookies(response, payload.session_id, 0) };
}
function sessionOrigin(): string {
  const origin = process.env.SITE_ORIGIN || "http://localhost:3000";
  if (!allowedOrigin(origin)) throw new Error("invalid session origin");
  return origin;
}
function cookieHeader(refresh: RefreshState): string {
  return Object.entries(refresh.cookies).map(([name, value]) => `${name}=${value}`).join("; ");
}
export function logoutUpstream(session: Pick<Session, "token" | "refresh">): Promise<Response> {
  return upstream("/auth/logout/v2", { method: "POST", headers: {
    Origin: sessionOrigin(), Authorization: `Bearer ${session.token}`,
    ...(session.refresh ? { "X-Session-Id": session.refresh.sessionId, Cookie: cookieHeader(session.refresh) } : {}),
  } });
}
export async function createSession(token: string, seconds: number, refresh?: RefreshState) {
  if (seconds <= 10 || !Number.isFinite(seconds)) throw new Error("expired");
  const id = randomSecret(), now = Date.now();
  const session: Session = { key: hash(id), token, refresh, tokenExpires: now + (seconds - 10) * 1000, csrf: randomSecret(), expires: now + (refresh ? duration("ADMIN_SESSION_MAX_SECONDS", 12 * 60 * 60 * 1000) : Math.min(300, seconds - 10) * 1000), idleExpires: now + duration("ADMIN_SESSION_IDLE_SECONDS", 2 * 60 * 60 * 1000), usedConfirmations: [] };
  // A successful redirect is issued only after the shared store acknowledges it.
  await createStoredSession(session.key, session, Math.min(session.expires, session.idleExpires));
  return { id, session };
}
export async function getSession(id?: string): Promise<Session | null> {
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const key = hash(id), value = await readStoredSession<Session>(key);
  if (!value || value.key !== key || value.expires <= Date.now() || value.idleExpires <= Date.now()) return null;
  return value;
}
export async function deleteSession(id?: string) { if (id && /^[A-Za-z0-9_-]{43}$/.test(id)) await deleteStoredSession(hash(id)); }
export async function getValidSession(id?: string): Promise<Session | null> {
  return validSession(id);
}
async function validSession(id?: string, rejectedToken?: string): Promise<Session | null> {
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  return withStoredSession(hash(id), async (save, remove) => {
    const session = await getSession(id);
    if (!session) return null;
    const persist = () => save(session, Math.min(session.expires, session.idleExpires));
    if (session.token === rejectedToken) session.tokenExpires = 0;
    if (session.tokenExpires <= Date.now()) {
      if (!session.refresh) { await remove(); return null; }
      async function renew(retries = 1): Promise<boolean> {
        const refresh = session!.refresh!;
        const operation = refresh.operation ??= { id: randomSecret(), generation: refresh.generation };
        // Persist before the remote commit, so another instance retries the SAME
        // operation if this process dies or loses the response.
        await persist();
        const response = await upstream("/auth/refresh/v2", { method: "POST", headers: {
          Origin: sessionOrigin(), Cookie: cookieHeader(refresh), "X-Session-Id": refresh.sessionId,
          "X-Refresh-Operation": operation.id, "X-Refresh-Generation": String(operation.generation),
        } });
        if (!await getSession(id)) return false;
        if (response.status === 401) return false;
        if (response.status === 409) {
          const failure = await response.json().catch(() => null);
          if (["RECOVERY_EXPIRED", "GENERATION_MISMATCH"].includes(failure?.code)
            && Number.isSafeInteger(failure.retry_generation) && failure.retry_generation >= refresh.generation && retries) {
            refresh.generation = failure.retry_generation;
            refresh.operation = undefined;
            return renew(retries - 1);
          }
          if (failure?.code === "RECOVERY_EXPIRED") return false;
        }
        if (!response.ok) throw new Error("refresh unavailable");
        const next = sessionCookies(response, refresh.sessionId, operation.generation + 1);
        Object.assign(refresh.cookies, next);
        // Headers can arrive before a lost/truncated body. Keep both generations.
        await persist();
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object" || !("access_token" in payload) || typeof payload.access_token !== "string" || !payload.access_token || !("expires_in" in payload) || typeof payload.expires_in !== "number" || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0
          || !("session_id" in payload) || payload.session_id !== refresh.sessionId || !("operation_id" in payload) || payload.operation_id !== operation.id || !("generation" in payload) || payload.generation !== operation.generation + 1) throw new Error("invalid refresh response");
        session!.token = payload.access_token;
        refresh.cookies = next;
        refresh.generation = payload.generation as number;
        refresh.operation = undefined;
        session!.tokenExpires = Date.now() + Math.max(0, payload.expires_in - 5) * 1000;
        return true;
      }
      let refreshed: boolean;
      try { refreshed = await renew(); } catch (error) { if (!await getSession(id)) return null; throw error; }
      if (!refreshed) { await remove(); return null; }
    }
    if (!await getSession(id)) return null;
    session.idleExpires = Date.now() + duration("ADMIN_SESSION_IDLE_SECONDS", 2 * 60 * 60 * 1000);
    await persist();
    return session;
  });
}
// Retry safe reads only; reuse a rotation already completed by another request.
export async function refreshAfterUnauthorized(id: string | undefined, rejectedToken: string): Promise<Session | null> {
  return validSession(id, rejectedToken);
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
export async function consumeConfirmation(session: Session, signature: string): Promise<boolean> {
  return withStoredSession(session.key, async save => {
    const current = await readStoredSession<Session>(session.key);
    if (!current || current.expires <= Date.now() || current.idleExpires <= Date.now() || current.usedConfirmations.length >= 1000 || current.usedConfirmations.includes(signature)) return false;
    current.usedConfirmations.push(signature);
    await save(current, Math.min(current.expires, current.idleExpires));
    return true;
  });
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
