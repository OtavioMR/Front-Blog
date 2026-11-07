import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { adminActor, consumeConfirmation, cookieName, escapeHtml, formBody, getSession, page, randomSecret, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const signature = (secret: string, values: string[]) => createHmac("sha256", secret).update(JSON.stringify(values)).digest("base64url");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const { id } = await params, query = new URL(request.url).searchParams, historyPage = query.get("page") || "1";
  if (!uuid.test(id) || query.getAll("page").length > 1 || !/^[1-9]\d{0,5}$/.test(historyPage)) return page("Solicitação inválida", "<p>Confira o endereço e a página.</p>", 400);
  try {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [detailResponse, historyResponse] = await Promise.all([upstream(`/admin/users/${id}`, { headers }), upstream(`/admin/users/${id}/moderation-history?page=${historyPage}&limit=10`, { headers })]);
    if ([detailResponse, historyResponse].some(r => r.status === 401)) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
    if ([detailResponse, historyResponse].some(r => r.status === 403)) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if ([detailResponse, historyResponse].some(r => r.status === 404)) return page("Conta indisponível", "<p>Esta conta não foi encontrada.</p>", 404);
    if (!detailResponse.ok || !historyResponse.ok) throw new Error("upstream");
    const detail: unknown = await detailResponse.json(), history: unknown = await historyResponse.json();
    if (!object(detail) || detail.id !== id || !string(detail.name, 255) || !string(detail.email, 255) || !["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(String(detail.role))
      || typeof detail.isActive !== "boolean" || typeof detail.moderationSuspended !== "boolean" || typeof detail.emailVerified !== "boolean" || !string(detail.createdAt, 100) || !Number.isFinite(Date.parse(detail.createdAt))
      || !object(detail.counts) || ![detail.counts.posts, detail.counts.comments].every(n => Number.isSafeInteger(n) && (n as number) >= 0)
      || !object(history) || !Array.isArray(history.data) || history.data.length > 10 || !object(history.meta) || history.meta.page !== Number(historyPage) || typeof history.meta.hasPreviousPage !== "boolean" || typeof history.meta.hasNextPage !== "boolean"
      || history.data.some(row => !object(row) || !string(row.action, 80) || !string(row.createdAt, 100) || !Number.isFinite(Date.parse(row.createdAt)) || !(row.actorId === null || (string(row.actorId, 36) && uuid.test(row.actorId))))) throw new Error("invalid");
    const rows = history.data.map(row => `<li>${escapeHtml(row.createdAt)} · ${escapeHtml(row.action)} · Responsável: ${escapeHtml(row.actorId || "Sistema")}${object(row.details) && string(row.details.reason, 1000) ? ` · Justificativa: ${escapeHtml(row.details.reason)}` : ""}</li>`).join("");
    const nav = `<nav aria-label="Paginação do histórico">${history.meta.hasPreviousPage && Number(historyPage) > 1 ? `<a href="?page=${Number(historyPage) - 1}">Anterior</a> ` : ""}Página ${historyPage}${history.meta.hasNextPage && Number(historyPage) < 999999 ? ` <a href="?page=${Number(historyPage) + 1}">Próxima</a>` : ""}</nav>`;
    const actor = await adminActor(session.token);
    const canModerate = ["READER", "AUTHOR"].includes(String(detail.role)) || (detail.role === "ADMIN" && actor?.role === "SUPER_ADMIN" && actor.id !== id);
    const actions = canModerate && (detail.isActive || detail.moderationSuspended) ? `<section><h2>Moderação da conta</h2><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="step" value="confirm"><input type="hidden" name="action" value="${detail.moderationSuspended ? "restore" : "suspend"}">${detail.moderationSuspended ? "<p>A restauração não altera artigos ocultados.</p>" : '<p>A suspensão encerra as sessões da conta. Sem data de término, o bloqueio é permanente.</p><label for="reason">Justificativa</label><textarea id="reason" name="reason" required minlength="5" maxlength="1000"></textarea><label for="endsAt">Término opcional (data e hora com fuso, por exemplo 2030-01-01T12:00:00Z)</label><input id="endsAt" name="endsAt" maxlength="35">'}<button>Revisar ${detail.moderationSuspended ? "restauração" : "suspensão"}</button></form></section>` : "";
    const roleLink = actor?.role === "SUPER_ADMIN" && actor.id !== id && detail.isActive ? `<p><a href="/admin/users/${id}/role">Gerenciar função</a></p>` : "";
    return page("Detalhes da conta", `<h2>${escapeHtml(detail.name)}</h2><p>Identificador: ${escapeHtml(id)}</p><p>E-mail: ${escapeHtml(detail.email)} · ${detail.emailVerified ? "confirmado" : "não confirmado"}</p><p>Papel: ${escapeHtml(String(detail.role))}</p><p>Situação: ${detail.moderationSuspended ? "Suspensa" : detail.isActive ? "Ativa" : "Inativa"}</p><p>Cadastro: ${escapeHtml(detail.createdAt)}</p><p>Artigos: ${detail.counts.posts} · Comentários: ${detail.counts.comments}</p><p><a href="/gestao-editorial/usuarios/${id}/denuncias">Ver denúncias relacionadas</a></p>${roleLink}${actions}<section><h2>Histórico administrativo</h2>${rows ? `<ol>${rows}</ol>` : "<p>Nenhuma ação registrada.</p>"}${nav}</section><p><a href="/gestao-editorial/usuarios">Voltar aos usuários</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar a conta e seu histórico.</p>", 503); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const { id } = await params, form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return page("Acesso negado", "<p>Solicitação inválida.</p>", 403);
  const step = form.get("step") || "", action = form.get("action") || "", reason = (form.get("reason") || "").trim(), endsAt = (form.get("endsAt") || "").trim();
  if (!uuid.test(id) || ["csrf", "step", "action", "reason", "endsAt", "timestamp", "nonce", "signature"].some(key => form.getAll(key).length > 1) || !["confirm", "execute"].includes(step) || !["suspend", "restore"].includes(action)
    || (action === "suspend" && (reason.length < 5 || reason.length > 1000 || (endsAt !== "" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(endsAt) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.now())))) || (action === "restore" && (reason !== "" || endsAt !== ""))) return page("Solicitação inválida", "<p>Confira a ação, a justificativa e o prazo.</p>", 400);
  const feedback = (title: string, message: string, status: number) => page(title, `<p>${message}</p>${reason ? `<label for="saved-reason">Justificativa informada</label><textarea id="saved-reason" readonly>${escapeHtml(reason)}</textarea>` : ""}<p><a href="/gestao-editorial/usuarios/${id}">Voltar à conta</a></p>`, status);
  try {
    if (step === "confirm") {
      const response = await upstream(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (response.status === 401) return feedback("Sessão expirada", "Entre novamente para continuar.", 401);
      if (response.status === 403) return feedback("Acesso negado", "Esta conta não possui permissão.", 403);
      if (response.status === 404) return feedback("Conta indisponível", "Esta conta não foi encontrada.", 404);
      if (!response.ok) throw new Error("upstream");
      const target: unknown = await response.json();
      const actor = await adminActor(session.token);
      const allowedTarget = object(target) && (["READER", "AUTHOR"].includes(String(target.role)) || (target.role === "ADMIN" && actor?.role === "SUPER_ADMIN" && actor.id !== id));
      if (!object(target) || target.id !== id || !string(target.name, 255) || !allowedTarget || (action === "suspend" ? target.isActive !== true : target.moderationSuspended !== true)) return feedback("Conta alterada", "Atualize a conta e verifique a ação disponível.", 409);
      const timestamp = String(Date.now()), nonce = randomSecret(), signed = signature(session.csrf, [id, action, reason, endsAt, timestamp, nonce]);
      return page("Confirmar moderação", `<p>Conta: ${escapeHtml(target.name)} (${escapeHtml(id)})</p><p>Ação: ${action === "suspend" ? "Suspender e revogar sessões" : "Restaurar conta"}</p>${reason ? `<p>Justificativa: ${escapeHtml(reason)}</p>` : ""}${action === "suspend" ? `<p>Término: ${endsAt ? escapeHtml(endsAt) : "sem prazo"}</p>` : ""}<form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="step" value="execute"><input type="hidden" name="action" value="${action}"><input type="hidden" name="reason" value="${escapeHtml(reason)}"><input type="hidden" name="endsAt" value="${escapeHtml(endsAt)}"><input type="hidden" name="timestamp" value="${timestamp}"><input type="hidden" name="nonce" value="${nonce}"><input type="hidden" name="signature" value="${signed}"><button>Confirmar</button></form><p><a href="/gestao-editorial/usuarios/${id}">Cancelar</a></p>`);
    }
    const timestamp = form.get("timestamp") || "", age = Date.now() - Number(timestamp);
    const signed = form.get("signature") || "", nonce = form.get("nonce") || "";
    if (!/^\d{13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || age < 0 || age > 300000 || !sameSecret(signed, signature(session.csrf, [id, action, reason, endsAt, timestamp, nonce])) || !consumeConfirmation(session, signed)) return feedback("Confirmação expirada", "Revise a ação novamente antes de confirmar.", 400);
    const response = await upstream(`/admin/users/${id}/${action === "suspend" ? "suspension" : "restore"}`, { method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" }, body: JSON.stringify(action === "suspend" ? { reason, ...(endsAt && { endsAt }) } : {}) });
    if (response.status === 401) return feedback("Sessão expirada", "Entre novamente para continuar.", 401);
    if (response.status === 403) return feedback("Acesso negado", "A operação não é permitida para esta conta.", 403);
    if (response.status === 404) return feedback("Conta indisponível", "Esta conta não foi encontrada.", 404);
    if (response.status === 409) return feedback("Conta alterada", "Atualize a conta antes de tentar novamente.", 409);
    if (response.status === 400 || response.status === 429) return feedback("Não foi possível concluir", response.status === 429 ? "Aguarde antes de tentar novamente." : "Confira os dados informados.", response.status);
    if (response.status !== 201) throw new Error("uncertain");
    const result: unknown = await response.json();
    if (!object(result) || result.suspended !== (action === "suspend")) throw new Error("uncertain");
    return new Response(null, { status: 303, headers: { Location: `/gestao-editorial/usuarios/${id}`, "Cache-Control": "no-store, private" } });
  } catch { return feedback("Resultado incerto", "Não foi possível confirmar a operação. Confira o estado da conta antes de tentar novamente.", 503); }
}
