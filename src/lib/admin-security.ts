import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type Session = { token: string; csrf: string; expires: number };
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
  const session = { token, csrf: randomSecret(), expires: Date.now() + Math.min(300, seconds - 10) * 1000 };
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

export async function upstream(path: string, init: RequestInit = {}): Promise<Response> {
  const origin = process.env.API_ORIGIN || "http://localhost:3001";
  return fetch(`${origin}/api/v1${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
}
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow", "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export function page(title: string, body: string, status = 200) { return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{font:16px system-ui;max-width:70rem;margin:3rem auto;padding:0 1rem;color:#243a31}article{border-top:1px solid #ccd5cc;padding:1rem 0}input,button{font:inherit;padding:.65rem;margin:.4rem 0}label{display:block}button{cursor:pointer}form.inline{display:inline-block;margin-right:1rem}</style><main><h1>${escapeHtml(title)}</h1>${body}</main></html>`, { status, headers }); }
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
