import { cookies } from "next/headers";
import { adminActor, cookieName, createSession, deleteSession, formBody, getSession, loginCookieName, loginRefreshState, logoutUpstream, page, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };
const unavailable = () => page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
const revoke = (token: string) => logoutUpstream({ token }).catch(() => undefined);

// Autentica pela API existente e só abre a sessão administrativa depois de confirmar o cargo ADMIN/SUPER_ADMIN com 2FA ativo.
export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return unavailable();
  const jar = await cookies(); const form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, jar.get(loginCookieName)?.value)) return page("Acesso negado", "<p>Solicitação inválida.</p>", 403);
  const email = form.get("email") || "", password = form.get("password") || "", code = form.get("totpCode") || "";
  if (!email || email.length > 255 || !password || Buffer.byteLength(password) > 72 || (code && !/^[a-zA-Z0-9-]{6,16}$/.test(code))) return page("Entrada indisponível", "<p>Confira os dados e tente novamente.</p>", 400);
  let issuedToken: string | null = null;
  try {
    const response = await upstream("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ...(code && { totpCode: code }) }) });
    if (!response.ok) return page("Entrada indisponível", "<p>Não foi possível entrar. Verifique os dados e tente novamente.</p>", response.status === 429 ? 429 : 401);
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "requires2fa" in payload && (payload as { requires2fa?: boolean }).requires2fa) {
      return new Response(JSON.stringify({
        error: "2fa_required",
        message: "Esta conta exige autenticação em duas etapas. Preencha o código do Google Authenticator ou código de recuperação abaixo.",
      }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, private" } });
    }
    if (!payload || typeof payload !== "object" || !("access_token" in payload) || typeof payload.access_token !== "string" || !payload.access_token || !("expires_in" in payload) || typeof payload.expires_in !== "number" || !Number.isFinite(payload.expires_in) || payload.expires_in <= 10) throw new Error("invalid");
    const token = payload.access_token;
    issuedToken = token;
    const refresh = loginRefreshState(response, payload as Record<string, unknown>);
    // O cargo é lido na API a cada entrada: contas comuns nunca recebem sessão administrativa.
    const actor = await adminActor(token);
    if (!actor) { await revoke(token); issuedToken = null; return page("Acesso negado", "<p>Esta conta não possui acesso administrativo.</p>", 403); }
    if (actor.totpEnabled === false) {
      await revoke(token);
      issuedToken = null;
      return new Response(JSON.stringify({
        error: "totp_mandatory",
        message: "Contas administrativas precisam ativar a autenticação de dois fatores (2FA) antes de acessar o painel editorial. Acesse as configurações da sua conta de leitor/autor para ativá-la.",
      }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, private" } });
    }
    const old = jar.get(cookieName)?.value; const prior = getSession(old);
    const revocation = prior ? logoutUpstream(prior).catch(() => undefined) : undefined;
    deleteSession(old);
    await revocation;
    const created = createSession(token, payload.expires_in, refresh);
    jar.set(cookieName, created.id, { ...options, maxAge: Math.floor((created.session.expires - Date.now()) / 1000) });
    jar.set(loginCookieName, "", { ...options, maxAge: 0 });
    issuedToken = null;
    return new Response(null, { status: 303, headers: { Location: "/gestao-editorial", "Cache-Control": "no-store, private" } });
  } catch {
    if (issuedToken) await revoke(issuedToken);
    return page("Serviço indisponível", "<p>Não foi possível confirmar a entrada.</p>", 503);
  }
}
