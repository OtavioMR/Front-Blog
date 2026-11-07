import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type Session = { token: string; csrf: string; expires: number; usedConfirmations: Set<string> };
const state = globalThis as typeof globalThis & { __editorialSessions?: Map<string, Session> };
const sessions = state.__editorialSessions ??= new Map();
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
export function createSession(token: string, seconds: number) {
  for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key);
  if (sessions.size >= 1000) throw new Error("capacity");
  const id = randomSecret();
  const session: Session = { token, csrf: randomSecret(), expires: Date.now() + Math.min(300, seconds - 10) * 1000, usedConfirmations: new Set() };
  if (session.expires <= Date.now()) throw new Error("expired");
  const key = hash(id);
  sessions.set(key, session);
  const timer = setTimeout(() => { if (sessions.get(key) === session) sessions.delete(key); }, session.expires - Date.now());
  timer.unref();
  return { id, session };
}
export function getSession(id?: string): Session | null {
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  const key = hash(id); const value = sessions.get(key);
  if (!value || value.expires <= Date.now()) { sessions.delete(key); return null; }
  return value;
}
export function deleteSession(id?: string) { if (id) sessions.delete(hash(id)); }
export type AdminActorInfo = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
  name?: string;
  email?: string;
  profilePhoto?: string | null;
};

// O sub apenas seleciona o perfil; o Nest valida o token e fornece a role atual.
export async function adminActor(token: string): Promise<AdminActorInfo | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1].length > 4096) return null;
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || !("sub" in payload) || typeof payload.sub !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) return null;
    const response = await upstream(`/users/${payload.sub}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("id" in value) || value.id !== payload.sub || !("role" in value) || (value.role !== "ADMIN" && value.role !== "SUPER_ADMIN")) return null;
    const name = "name" in value && typeof value.name === "string" ? value.name : undefined;
    const email = "email" in value && typeof value.email === "string" ? value.email : undefined;
    const profilePhoto = "profilePhoto" in value && (typeof value.profilePhoto === "string" || value.profilePhoto === null) ? value.profilePhoto : null;
    return { id: payload.sub, role: value.role, name, email, profilePhoto };
  } catch { return null; }
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
