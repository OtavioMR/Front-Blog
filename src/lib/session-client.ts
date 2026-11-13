"use client";

// This record holds coordination state only. Credentials never enter browser storage or messages.
const KEY = "blog-session-coordination-v2";
const LOCK = "blog-session-v2";
type RefreshOperation = { id: string; generation: number; deadline?: number };
type RecordState = { epoch: string; pending: boolean; sessionId?: string; generation?: number; operation?: RefreshOperation; loggedOut?: boolean };
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
  const record = state as RecordState;
  if (record.sessionId !== undefined && (!/^[0-9a-f-]{36}$/i.test(record.sessionId) || !Number.isSafeInteger(record.generation) || record.generation! < 0)) throw new Error("Coordenação de sessão inválida.");
  if (record.operation && (!record.sessionId || !/^[A-Za-z0-9_-]{43}$/.test(record.operation.id) || !Number.isSafeInteger(record.operation.generation) || record.operation.generation < 0)) throw new Error("Operação de sessão inválida.");
  return record;
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
    channel.onmessage = (event) => {
      if (event.data?.type === "session-changed") {
        if (token?.epoch !== readState()?.epoch) token = null;
        notify();
      }
    };
  }
}
async function locked<T>(action: () => Promise<T>): Promise<T> {
  ready();
  return navigator.locks.request(LOCK, action);
}
async function tokensFrom(response: Response, epoch: string) {
  const data: unknown = await response.json();
  acceptLogin(data, epoch);
}
function accessToken(data: unknown, epoch: string): Token {
  if (!data || typeof data !== "object" || !("access_token" in data) || typeof data.access_token !== "string" || !data.access_token || !("token_type" in data) || data.token_type !== "Bearer" || !("expires_in" in data) || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("Resposta de sessão inválida. Entre novamente.");
  return { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000, epoch };
}
function acceptLogin(data: unknown, epoch: string) {
  const issued = accessToken(data, epoch);
  const value = data as Record<string, unknown>;
  if (value.refresh_protocol !== 2 || typeof value.session_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.session_id) || value.refresh_generation !== 0) throw new Error("Protocolo de sessão inválido.");
  if (readState()?.epoch !== epoch) throw new Error("Conta alterada durante a entrada.");
  saveState({ epoch, pending: false, sessionId: value.session_id, generation: 0 });
  token = issued;
}
function operationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const profileListeners = new Set<() => void>();
// Lets header/menu components refetch the confirmed profile after login, logout or a photo change.
function notifyProfile() { profileListeners.forEach((listener) => listener()); }
export const notifyProfileChanged = notifyProfile;
export function subscribeProfile(listener: () => void) { profileListeners.add(listener); return () => { profileListeners.delete(listener); }; }
export function subscribeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export type LoginResult = { ok: true } | { requires2fa: true; preAuthToken: string };

export async function login(email: string, password: string, totpCode?: string): Promise<LoginResult> {
  return locked(async () => {
    const previousState = readState();
    const previousToken = token;
    const epoch = crypto.randomUUID();
    saveState({ epoch, pending: true });
    let response: Response;
    try {
      response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000), body: JSON.stringify({ email, password, ...(totpCode && { totpCode }) }) });
    } catch { restoreState(previousState); token = previousToken; throw new Error("Não foi possível confirmar a entrada. Tente entrar novamente."); }
    if ([400, 401, 403, 429].includes(response.status)) {
      restoreState(previousState);
      token = previousToken;
      if (response.status === 401) throw new Error("Credenciais inválidas ou conta ainda não confirmada. Confira seus dados e o código, se necessário.");
      if (response.status === 403) {
        let msg = "Esta conta não pode entrar no momento.";
        try {
          const err = await response.json();
          if (err && typeof err === "object") {
            const reason = "reason" in err && typeof err.reason === "string" ? err.reason : "";
            const endsAt = "endsAt" in err && typeof err.endsAt === "string" ? err.endsAt : "";
            if (reason || endsAt) {
              msg = `Conta suspensa. ${reason ? `Motivo: ${reason}. ` : ""}${endsAt ? `Término: ${endsAt}. ` : ""}Acesse a página de contato para solicitar recurso.`;
            } else if ("message" in err && typeof err.message === "string") {
              msg = err.message;
            }
          }
        } catch { /* use default msg */ }
        throw new Error(msg);
      }
      if (response.status === 429) throw new Error("Muitas tentativas. Aguarde um pouco e tente novamente.");
      throw new Error("Confira os dados informados e tente novamente.");
    }
    try {
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (data && typeof data === "object" && "requires2fa" in data && data.requires2fa) {
        restoreState(previousState);
        token = previousToken;
        if (!("preAuthToken" in data) || typeof data.preAuthToken !== "string" || !data.preAuthToken) {
          throw new Error("Desafio de autenticação inválido.");
        }
        return { requires2fa: true, preAuthToken: data.preAuthToken };
      }
      if (!data || typeof data !== "object" || !("access_token" in data) || typeof data.access_token !== "string" || !data.access_token || !("token_type" in data) || data.token_type !== "Bearer" || !("expires_in" in data) || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
        throw new Error("Resposta de sessão inválida.");
      }
      acceptLogin(data, epoch);
    } catch { restoreState(previousState); token = previousToken; throw new Error("Não foi possível confirmar a entrada. Tente entrar novamente."); }
    broadcast();
    notifyProfile();
    return { ok: true };
  });
}

export async function verify2fa(preAuthToken: string, code: string): Promise<void> {
  return locked(async () => {
    const previousState = readState();
    const previousToken = token;
    const epoch = crypto.randomUUID();
    saveState({ epoch, pending: true });
    let response: Response;
    try {
      response = await fetch("/api/v1/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ preAuthToken, code }),
      });
    } catch {
      restoreState(previousState); token = previousToken;
      throw new Error("Não foi possível validar o código de autenticação.");
    }
    if ([400, 401, 403, 429].includes(response.status)) {
      restoreState(previousState); token = previousToken;
      if (response.status === 401) throw new Error("Código de autenticação ou de recuperação inválido ou expirado.");
      if (response.status === 429) throw new Error("Muitas tentativas. Aguarde um pouco e tente novamente.");
      throw new Error("Não foi possível validar o código informado.");
    }
    try {
      if (!response.ok) throw new Error();
      await tokensFrom(response, epoch);
    } catch {
      restoreState(previousState); token = previousToken;
      throw new Error("Não foi possível confirmar a autenticação.");
    }
    broadcast();
    notifyProfile();
  });
}

// Persist the operation BEFORE sending. A reload/retry must present the same ID,
// generation and HttpOnly proof; creating a different ID after a lost commit is reuse.
async function refreshLocked(state: RecordState, retries = 1): Promise<"ok" | "unauthorized" | "uncertain"> {
  if (!state.sessionId || state.generation === undefined || state.loggedOut) return "unauthorized";
  const operation = state.operation && (state.pending || (state.operation.deadline ?? 0) > Date.now() + 5000)
    ? state.operation : { id: operationId(), generation: state.generation };
  saveState({ ...state, pending: true, operation });
  try {
    const response = await fetch("/api/v1/auth/refresh/v2", { method: "POST", headers: {
      "X-Session-Id": state.sessionId, "X-Refresh-Operation": operation.id, "X-Refresh-Generation": String(operation.generation),
    }, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data: unknown = await response.json();
    const current = readState();
    if (current?.epoch !== state.epoch || current.loggedOut || current.operation?.id !== operation.id) return "unauthorized";
    if (!response.ok) {
      token = null;
      const failure = data && typeof data === "object" ? data as Record<string, unknown> : {};
      if (response.status === 409 && ["RECOVERY_EXPIRED", "GENERATION_MISMATCH"].includes(String(failure.code))
        && typeof failure.retry_generation === "number" && Number.isSafeInteger(failure.retry_generation) && failure.retry_generation >= state.generation) {
        const next = { ...state, generation: failure.retry_generation, pending: false, operation: undefined };
        saveState(next);
        return retries ? refreshLocked(next, retries - 1) : "uncertain";
      }
      if (response.status === 401 || (response.status === 409 && failure.code === "RECOVERY_EXPIRED")) {
        saveState({ epoch: crypto.randomUUID(), pending: true, loggedOut: true, sessionId: state.sessionId, generation: state.generation });
        broadcast();
        return "unauthorized";
      }
      return "uncertain";
    }
    const issued = accessToken(data, state.epoch);
    const value = data as Record<string, unknown>;
    const deadline = typeof value.recovery_deadline === "string" ? Date.parse(value.recovery_deadline) : NaN;
    if (value.session_id !== state.sessionId || value.operation_id !== operation.id || value.generation !== operation.generation + 1 || !Number.isFinite(deadline)) throw new Error("Resposta de renovação inválida.");
    saveState({ ...state, generation: value.generation as number, pending: false, operation: { ...operation, deadline } });
    token = issued;
    return "ok";
  } catch { token = null; return "uncertain"; }
}

export function restoreSession(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = locked(async () => {
    return ensureTokenLocked();
  }).finally(() => { inflight = null; });
  return inflight;
}

async function ensureTokenLocked(): Promise<boolean> {
  const state = readState();
  if (!state || state.loggedOut || (state.pending && !state.operation)) { token = null; return false; }
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
    if (state && !state.loggedOut) {
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

export type OwnProfile = { id: string; name: string; email: string; role: string; emailVerified: boolean; bio: string | null; profilePhoto?: string | null; firstPostApproved?: boolean; totpEnabled?: boolean };

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
    if (profile.id !== id || typeof profile.name !== "string" || typeof profile.email !== "string" || typeof profile.role !== "string" || typeof profile.emailVerified !== "boolean" || !(profile.bio === null || typeof profile.bio === "string") || !(profile.firstPostApproved === undefined || typeof profile.firstPostApproved === "boolean") || !(profile.profilePhoto === undefined || profile.profilePhoto === null || typeof profile.profilePhoto === "string") || !(profile.totpEnabled === undefined || typeof profile.totpEnabled === "boolean")) throw new Error("Resposta de perfil inválida.");
    return profile as OwnProfile;
  });
}

export async function logout(): Promise<boolean> {
  return locked(async () => {
    const state = readState();
    const current = token?.epoch === state?.epoch ? token : null;
    token = null;
    saveState({ epoch: crypto.randomUUID(), pending: true, loggedOut: true, sessionId: state?.sessionId, generation: state?.generation });
    broadcast();
    notifyProfile();
    if (!state?.sessionId) return false;
    try {
      const response = await fetch("/api/v1/auth/logout/v2", { method: "POST", headers: {
        "X-Session-Id": state.sessionId, ...(current ? { Authorization: `Bearer ${current.value}` } : {}),
      }, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
      return response.ok;
    } catch { return false; }
  });
}
