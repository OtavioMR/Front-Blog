import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { consumeConfirmation, cookieName, escapeHtml, formBody, getSession, page, randomSecret, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 2000): v is string => typeof v === "string" && v.length <= max;
const nullableText = (v: unknown, max = 2000) => v === null || text(v, max);
const confirmation = (secret: string, id: string, decision: string | null, action: string | null, note: string, timestamp: string, nonce: string) => createHmac("sha256", secret).update(JSON.stringify([id, decision, action, note, timestamp, nonce])).digest("base64url");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const { id } = await params;
  const query = new URL(request.url).searchParams, historyPage = query.get("page") || "1";
  if (!uuid.test(id) || query.getAll("page").length > 1 || !/^[1-9]\d{0,5}$/.test(historyPage)) return page("Solicitação inválida", "<p>Confira o endereço e a página.</p>", 400);
  try {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [detailResponse, historyResponse] = await Promise.all([
      upstream(`/reports/${id}`, { headers }), upstream(`/reports/${id}/history?page=${historyPage}&limit=10`, { headers }),
    ]);
    if ([detailResponse, historyResponse].some(response => response.status === 401)) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
    if ([detailResponse, historyResponse].some(response => response.status === 403)) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if ([detailResponse, historyResponse].some(response => response.status === 404)) return page("Denúncia indisponível", "<p>A denúncia não foi encontrada.</p>", 404);
    if (!detailResponse.ok || !historyResponse.ok) throw new Error("upstream");
    const detail: unknown = await detailResponse.json(), history: unknown = await historyResponse.json();
    if (!object(detail) || detail.id !== id || !text(detail.reason, 1000) || !nullableText(detail.description) || !nullableText(detail.reasonCategory, 30)
      || !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(detail.status)) || !nullableText(detail.moderatorId, 36)
      || !nullableText(detail.moderationNote, 1000) || !text(detail.createdAt, 100) || !Number.isFinite(Date.parse(detail.createdAt))
      || !(detail.target === null || object(detail.target)) || !object(history) || !Array.isArray(history.data) || history.data.length > 10 || !object(history.meta)
      || history.meta.page !== Number(historyPage) || typeof history.meta.hasPreviousPage !== "boolean" || typeof history.meta.hasNextPage !== "boolean"
      || history.data.some(row => !object(row) || !text(row.id, 36) || !uuid.test(row.id) || !text(row.action, 80) || !nullableText(row.actorId, 36) || !text(row.createdAt, 100) || !Number.isFinite(Date.parse(row.createdAt)))) throw new Error("invalid");
    const target = detail.target;
    let context = "<p>O conteúdo não está mais disponível.</p>";
    if (target !== null) {
      if (!["POST", "COMMENT", "USER"].includes(String(target.type)) || !text(target.id, 36) || !uuid.test(target.id)) throw new Error("invalid target");
      if (target.type === "USER") {
        if (!text(target.name, 255)) throw new Error("invalid target");
        context = `<p>Perfil: ${escapeHtml(target.name)}</p>`;
      } else {
        if (!text(target.content, 1000000) || (target.type === "POST" && !text(target.title, 255))) throw new Error("invalid target");
        const content = target.type === "POST" ? sanitizeHtml(target.content, { allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3"], allowedAttributes: {} }) : `<p>${escapeHtml(target.content)}</p>`;
        context = `${target.type === "POST" ? `<h3>${escapeHtml(target.title as string)}</h3>` : "<h3>Comentário</h3>"}${content}`;
      }
    }
    const rows = history.data.map(row => `<li><time datetime="${escapeHtml(row.createdAt)}">${escapeHtml(row.createdAt)}</time> · ${escapeHtml(row.action)} · Responsável: ${escapeHtml(row.actorId || "Sistema")}</li>`).join("");
    const nav = `<nav aria-label="Paginação do histórico">${history.meta.hasPreviousPage && Number(historyPage) > 1 ? `<a href="?page=${Number(historyPage) - 1}">Anterior</a> ` : ""}Página ${historyPage}${history.meta.hasNextPage && Number(historyPage) < 999999 ? ` <a href="?page=${Number(historyPage) + 1}">Próxima</a>` : ""}</nav>`;
    const actionOptions = target?.type === "POST" ? '<option value="HIDE_POST">Ocultar artigo</option>' : target?.type === "COMMENT" ? '<option value="HIDE_COMMENT">Ocultar comentário</option>' : "";
    const actions = ["PENDING", "IN_REVIEW"].includes(String(detail.status)) ? `<section><h2>Decisão</h2><p>Uma ocultação altera a visibilidade do conteúdo denunciado.</p><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="step" value="confirm"><label for="decision">Decisão</label><select id="decision" name="decision" required><option value="RESOLVED">Procedente</option><option value="DISMISSED">Improcedente</option></select><label for="action">Ação sobre o conteúdo</label><select id="action" name="action"><option value="NONE">Nenhuma</option>${actionOptions}</select><label for="note">Justificativa</label><textarea id="note" name="note" required minlength="5" maxlength="1000"></textarea><button>Revisar decisão</button></form></section>` : "";
    return page("Detalhes da denúncia", `<p>Identificador: ${escapeHtml(id)}</p><p>Situação: ${escapeHtml(String(detail.status))}</p><p>Motivo: ${escapeHtml(detail.reason)}</p>${detail.reasonCategory ? `<p>Categoria: ${escapeHtml(detail.reasonCategory as string)}</p>` : ""}${detail.description ? `<p>Descrição: ${escapeHtml(detail.description as string)}</p>` : ""}<p>Recebida em: ${escapeHtml(detail.createdAt)}</p><p>Responsável: ${escapeHtml((detail.moderatorId as string | null) || "Não atribuído")}</p>${detail.moderationNote ? `<p>Justificativa: ${escapeHtml(detail.moderationNote as string)}</p>` : ""}<section><h2>Conteúdo denunciado</h2>${context}</section>${actions}<section><h2>Histórico de moderação</h2>${rows ? `<ol>${rows}</ol>` : "<p>Nenhuma ação registrada.</p>"}${nav}</section><p><a href="/gestao-editorial/denuncias">Voltar às denúncias</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar a denúncia e seu histórico.</p>", 503); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const { id } = await params, form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return page("Acesso negado", "<p>Solicitação inválida.</p>", 403);
  const step = form.get("step"), decision = form.get("decision"), action = form.get("action"), note = (form.get("note") || "").trim();
  if (!uuid.test(id) || ["csrf", "step", "decision", "action", "note"].some(key => form.getAll(key).length !== 1) || !["confirm", "execute"].includes(step || "") || !["RESOLVED", "DISMISSED"].includes(decision || "") || !["NONE", "HIDE_POST", "HIDE_COMMENT"].includes(action || "") || (decision === "DISMISSED" && action !== "NONE") || note.length < 5 || note.length > 1000) return page("Solicitação inválida", "<p>Confira a decisão, a ação e a justificativa.</p>", 400);
  const feedback = (title: string, message: string, status: number) => page(title, `<p>${message}</p><label for="saved-note">Justificativa informada</label><textarea id="saved-note" readonly>${escapeHtml(note)}</textarea><p><a href="/gestao-editorial/denuncias/${id}">Voltar à denúncia</a></p>`, status);
  try {
    if (step === "confirm") {
      const response = await upstream(`/reports/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (response.status === 401) return feedback("Sessão expirada", "Entre novamente para continuar.", 401);
      if (response.status === 403) return feedback("Acesso negado", "Esta conta não possui permissão.", 403);
      if (response.status === 404) return feedback("Denúncia indisponível", "A denúncia não foi encontrada.", 404);
      if (!response.ok) throw new Error("unavailable");
      const value: unknown = await response.json();
      if (!object(value) || value.id !== id || !["PENDING", "IN_REVIEW"].includes(String(value.status))) return feedback("Denúncia alterada", "Atualize os detalhes antes de decidir.", 409);
      const targetType = object(value.target) ? value.target.type : null;
      if ((action === "HIDE_POST" && targetType !== "POST") || (action === "HIDE_COMMENT" && targetType !== "COMMENT")) return feedback("Solicitação inválida", "A ação não corresponde ao conteúdo denunciado.", 400);
      const label = action === "HIDE_POST" ? "Ocultar artigo" : action === "HIDE_COMMENT" ? "Ocultar comentário" : "Nenhuma alteração no conteúdo";
      const timestamp = String(Date.now()), nonce = randomSecret(), signature = confirmation(session.csrf, id, decision, action, note, timestamp, nonce);
      return page("Confirmar decisão", `<p>Denúncia: ${escapeHtml(id)}</p><p>Decisão: ${decision === "RESOLVED" ? "Procedente" : "Improcedente"}</p><p>Ação: ${label}</p><p>Justificativa: ${escapeHtml(note)}</p><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="step" value="execute"><input type="hidden" name="decision" value="${decision}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="note" value="${escapeHtml(note)}"><input type="hidden" name="timestamp" value="${timestamp}"><input type="hidden" name="nonce" value="${nonce}"><input type="hidden" name="signature" value="${signature}"><button>Confirmar decisão</button></form><p><a href="/gestao-editorial/denuncias/${id}">Cancelar</a></p>`);
    }
    const timestamp = form.get("timestamp") || "", age = Date.now() - Number(timestamp);
    const signed = form.get("signature") || "", nonce = form.get("nonce") || "";
    if (form.getAll("timestamp").length !== 1 || form.getAll("nonce").length !== 1 || form.getAll("signature").length !== 1 || !/^\d{13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || age < 0 || age > 300000 || !sameSecret(signed, confirmation(session.csrf, id, decision, action, note, timestamp, nonce)) || !consumeConfirmation(session, signed)) return feedback("Confirmação expirada", "Revise a decisão novamente antes de confirmar.", 400);
    const response = await upstream(`/reports/${id}/resolve`, { method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: decision, action, note }) });
    if (response.status === 401) return feedback("Sessão expirada", "Entre novamente para continuar.", 401);
    if (response.status === 403) return feedback("Acesso negado", "Esta conta não possui permissão.", 403);
    if (response.status === 400) return feedback("Solicitação inválida", "Confira os dados da decisão.", 400);
    if (response.status === 404) return feedback("Denúncia indisponível", "A denúncia não foi encontrada.", 404);
    if (response.status === 409) return feedback("Denúncia alterada", "Atualize os detalhes antes de decidir.", 409);
    if (response.status === 429) return feedback("Muitas tentativas", "Aguarde antes de tentar novamente.", 429);
    if (response.status !== 201) throw new Error("uncertain");
    const value: unknown = await response.json();
    if (!object(value) || value.id !== id || value.status !== decision || value.action !== action) throw new Error("uncertain");
    return new Response(null, { status: 303, headers: { Location: `/gestao-editorial/denuncias/${id}`, "Cache-Control": "no-store, private" } });
  } catch { return feedback("Resultado incerto", "Não foi possível confirmar a operação. Confira a denúncia antes de tentar novamente.", 503); }
}
