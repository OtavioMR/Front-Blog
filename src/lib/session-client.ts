"use client";

// This record holds coordination state only. Credentials never enter browser storage or messages.
const KEY = "blog-session-coordination-v1";
const LOCK = "blog-session-v1";
type RecordState = { epoch: string; pending: boolean };
type Token = { value: string; expiresAt: number; epoch: string };
let token: Token | null = null;
let inflight: Promise<boolean> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach((listener) => listener()); }
function broadcast() { channel?.postMessage({ type: "session-changed" }); }
function readState(): RecordState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const state: unknown = JSON.parse(raw);
  if (!state || typeof state !== "object" || !("epoch" in state) || typeof state.epoch !== "string" || !("pending" in state) || typeof state.pending !== "boolean") throw new Error("Coordenação indisponível. Entre novamente.");
  return state as RecordState;
}
function saveState(state: RecordState) { localStorage.setItem(KEY, JSON.stringify(state)); }
function restoreState(state: RecordState | null) {
  if (state) saveState(state);
  else localStorage.removeItem(KEY);
}
function ready() {
  if (!("locks" in navigator) || typeof BroadcastChannel === "undefined") throw new Error("Este navegador não oferece a coordenação necessária para entrar com segurança.");
  if (!channel) {
    channel = new BroadcastChannel(LOCK);
    channel.onmessage = (event) => { if (event.data?.type === "session-changed") { token = null; notify(); } };
  }
}
async function locked<T>(action: () => Promise<T>): Promise<T> {
  ready();
  return navigator.locks.request(LOCK, action);
}
async function tokensFrom(response: Response, epoch: string) {
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("access_token" in data) || typeof data.access_token !== "string" || !data.access_token || !("token_type" in data) || data.token_type !== "Bearer" || !("expires_in" in data) || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("Resposta de sessão inválida. Entre novamente.");
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000, epoch };
}

const profileListeners = new Set<() => void>();
// Lets header/menu components refetch the confirmed profile after login, logout or a photo change.
function notifyProfile() { profileListeners.forEach((listener) => listener()); }
export const notifyProfileChanged = notifyProfile;
export function subscribeProfile(listener: () => void) { profileListeners.add(listener); return () => { profileListeners.delete(listener); }; }
export function subscribeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export async function login(email: string, password: string, totpCode: string): Promise<void> {
  await locked(async () => {
    const previousState = readState();
    const previousToken = token;
    const epoch = crypto.randomUUID();
    saveState({ epoch, pending: true });
    let response: Response;
    try {
      response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000), body: JSON.stringify({ email, password, ...(totpCode && { totpCode }) }) });
    } catch { token = null; broadcast(); throw new Error("Não foi possível confirmar a entrada. Tente entrar novamente."); }
    if ([400, 401, 403, 429].includes(response.status)) {
      restoreState(previousState);
      token = previousToken;
      if (response.status === 401) throw new Error("Credenciais inválidas ou conta ainda não confirmada. Confira seus dados e o código, se necessário.");
      if (response.status === 403) throw new Error("Esta conta não pode entrar no momento.");
      if (response.status === 429) throw new Error("Muitas tentativas. Aguarde um pouco e tente novamente.");
      throw new Error("Confira os dados informados e tente novamente.");
    }
    try {
      if (!response.ok) throw new Error();
      await tokensFrom(response, epoch);
      saveState({ epoch, pending: false });
    } catch { token = null; broadcast(); throw new Error("Não foi possível confirmar a entrada. Tente entrar novamente."); }
    broadcast();
    notifyProfile();
  });
}

// Must only run while holding LOCK. A pending marker remains after any uncertain result.
async function refreshLocked(state: RecordState): Promise<"ok" | "unauthorized" | "uncertain"> {
  saveState({ ...state, pending: true });
  try {
    const response = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) { token = null; broadcast(); return response.status === 401 ? "unauthorized" : "uncertain"; }
    await tokensFrom(response, state.epoch);
    saveState({ ...state, pending: false });
    return "ok";
  } catch { token = null; broadcast(); return "uncertain"; }
}

export function restoreSession(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = locked(async () => {
    const state = readState();
    if (token && token.epoch === state?.epoch && token.expiresAt > Date.now() + 5000 && !state.pending) return true;
    token = null;
    if (!state || state.pending) return false;
    return (await refreshLocked(state)) === "ok";
  }).finally(() => { inflight = null; });
  return inflight;
}

async function ensureTokenLocked(): Promise<boolean> {
  const state = readState();
  if (!state || state.pending) { token = null; return false; }
  if (token && token.epoch === state.epoch && token.expiresAt > Date.now() + 5000) return true;
  token = null;
  const result = await refreshLocked(state);
  if (result === "uncertain") throw new Error("Não foi possível confirmar a sessão. Entre novamente se o problema persistir.");
  return result === "ok";
}

// Caller holds the session lock, preventing an account switch during the request.
async function fetchLocked(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, window.location.origin);
  if (!path.startsWith("/api/v1/") || url.origin !== window.location.origin || !url.pathname.startsWith("/api/v1/")) throw new Error("Caminho de API inválido.");
  if (!(await ensureTokenLocked()) || !token) return new Response(null, { status: 401 });
  const method = (init.method || "GET").toUpperCase();
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token!.value}`);
    return fetch(`${url.pathname}${url.search}`, { ...init, method, headers, cache: "no-store", credentials: "omit", redirect: "error", signal: init.signal || AbortSignal.timeout(10000) });
  };
  let response = await send();
  if (response.status === 401 && (method === "GET" || method === "HEAD")) {
    const state = readState();
    if (state && !state.pending) {
      const refresh = await refreshLocked(state);
      if (refresh === "uncertain") throw new Error("Não foi possível confirmar a sessão.");
      if (refresh === "ok" && token) response = await send();
    }
  }
  return response;
}

export async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  return locked(() => fetchLocked(path, init));
}

function tokenSubject(value: string): string {
  try {
    const payload = value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const id: unknown = JSON.parse(atob(payload)).sub;
    if (typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
  } catch { /* Invalid token payload. */ }
  throw new Error("Sessão inválida.");
}

// Subject is only a concurrency check; the API remains responsible for authorization.
export async function authenticatedFetchForSubject(expectedId: string, path: string, init?: RequestInit): Promise<Response> {
  return locked(async () => {
    if (!(await ensureTokenLocked()) || !token) return new Response(null, { status: 401 });
    if (tokenSubject(token.value) !== expectedId) return new Response(null, { status: 409 });
    return fetchLocked(path, init);
  });
}

// Used after credentials may have changed. Never clear a newly switched account.
export async function invalidateSessionForSubject(expectedId: string): Promise<boolean> {
  return locked(async () => {
    const state = readState();
    if (!token || !state || state.pending || token.epoch !== state.epoch || tokenSubject(token.value) !== expectedId) return false;
    token = null;
    try { saveState({ epoch: crypto.randomUUID(), pending: true }); }
    finally { broadcast(); }
    return true;
  });
}

export type OwnProfile = { id: string; name: string; email: string; role: string; emailVerified: boolean; bio: string | null; profilePhoto?: string | null; firstPostApproved?: boolean };

export async function getOwnProfile(): Promise<OwnProfile | null> {
  return locked(async () => {
    if (!(await ensureTokenLocked()) || !token) return null;
    const id = tokenSubject(token.value);
    const response = await fetchLocked(`/api/v1/users/${id}`);
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Não foi possível carregar seu perfil.");
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta de perfil inválida.");
    const profile = value as Record<string, unknown>;
    if (profile.id !== id || typeof profile.name !== "string" || typeof profile.email !== "string" || typeof profile.role !== "string" || typeof profile.emailVerified !== "boolean" || !(profile.bio === null || typeof profile.bio === "string") || !(profile.firstPostApproved === undefined || typeof profile.firstPostApproved === "boolean") || !(profile.profilePhoto === undefined || profile.profilePhoto === null || typeof profile.profilePhoto === "string")) throw new Error("Resposta de perfil inválida.");
    return profile as OwnProfile;
  });
}

export async function logout(): Promise<boolean> {
  return locked(async () => {
    const state = readState();
    if (!token || !state || token.epoch !== state.epoch || state.pending) { token = null; return false; }
    if (token.expiresAt <= Date.now() + 5000 && (await refreshLocked(state)) !== "ok") return false;
    const current = token;
    if (!current) return false;
    token = null;
    saveState({ epoch: crypto.randomUUID(), pending: true });
    broadcast();
    notifyProfile();
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${current.value}` }, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
      return response.ok;
    } catch { return false; }
  });
}
