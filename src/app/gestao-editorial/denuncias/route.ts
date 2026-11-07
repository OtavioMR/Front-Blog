import { cookies } from "next/headers";
import { cookieName, escapeHtml, formBody, getSession, page, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied = () => page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
const missing = () => page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
const forbidden = () => page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export async function GET(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return missing();
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return denied();
  const query = new URL(request.url).searchParams;
  const rawPage = query.get("page") || "1";
  const status = query.get("status") || "PENDING", target = query.get("target") || "";
  if (["page", "status", "target"].some(key => query.getAll(key).length > 1) || !/^[1-9]\d{0,5}$/.test(rawPage) || !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED", "ALL"].includes(status) || !["", "POST", "COMMENT", "USER"].includes(target)) return page("Filtros inválidos", "<p>Confira os filtros e o número da página.</p>", 400);
  try {
    const apiQuery = new URLSearchParams();
    if (status !== "ALL") apiQuery.set("status", status);
    if (target) apiQuery.set("target", target);
    apiQuery.set("page", rawPage); apiQuery.set("limit", "20");
    const response = await upstream(`/reports?${apiQuery}`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return denied();
    if (response.status === 403) return forbidden();
    if (!response.ok) throw new Error("upstream");
    const value: unknown = await response.json();
    if (!record(value) || !Array.isArray(value.data) || value.data.length > 20 || !record(value.meta)
      || value.meta.page !== Number(rawPage) || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean"
      || (rawPage === "1" && value.meta.hasPreviousPage) || (rawPage === "999999" && value.meta.hasNextPage)
      || value.data.some(item => !record(item) || typeof item.id !== "string" || !uuid.test(item.id) || typeof item.reason !== "string" || item.reason.length > 1000 || !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(item.status)) || (status !== "ALL" && item.status !== status)
        || [item.postId, item.commentId, item.userId].filter(target => typeof target === "string" && uuid.test(target)).length !== 1
        || [item.postId, item.commentId, item.userId].some(target => target != null && (typeof target !== "string" || !uuid.test(target))))) throw new Error("invalid");
    const items = value.data.map(item => `<article><h2>Denúncia ${escapeHtml(item.id)}</h2><p>${item.postId ? "Artigo" : item.commentId ? "Comentário" : "Perfil"}: ${escapeHtml(item.postId || item.commentId || item.userId)}</p><p>Motivo: ${escapeHtml(item.reason)}</p><p>Situação: ${escapeHtml(item.status)}</p><p><a href="/gestao-editorial/denuncias/${item.id}">Ver detalhes e histórico</a></p></article>`).join("");
    const link = (number: number) => { const params = new URLSearchParams(); params.set("page", String(number)); if (status !== "PENDING") params.set("status", status); if (target) params.set("target", target); return `?${escapeHtml(params.toString())}`; };
    const nav = `<nav aria-label="Paginação">${value.meta.hasPreviousPage ? `<a href="${link(Number(rawPage) - 1)}">Anterior</a> ` : ""}Página ${rawPage}${value.meta.hasNextPage ? ` <a href="${link(Number(rawPage) + 1)}">Próxima</a>` : ""}</nav>`;
    const options = (entries: [string, string][], selected: string) => entries.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
    const filters = `<form method="get"><label for="status">Situação</label><select id="status" name="status">${options([["PENDING", "Pendente"], ["IN_REVIEW", "Em análise"], ["RESOLVED", "Resolvida"], ["DISMISSED", "Improcedente"], ["ALL", "Todas"]], status)}</select><label for="target">Tipo de conteúdo</label><select id="target" name="target">${options([["", "Todos"], ["POST", "Artigo"], ["COMMENT", "Comentário"], ["USER", "Perfil"]], target)}</select><button>Filtrar</button></form>`;
    const notice = query.getAll("resultado").length === 1 && query.get("resultado") === "registrado" ? '<p role="status">Decisão registrada.</p>' : "";
    return page("Denúncias", `${notice}<p>A decisão registra a análise e não altera o conteúdo automaticamente.</p>${filters}${items || "<p>Nenhuma denúncia nesta página.</p>"}${nav}<p><a href="/gestao-editorial">Voltar à revisão editorial</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar as denúncias.</p>", 503); }
}

export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return missing();
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return denied();
  const form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return forbidden();
  const id = form.get("id") || "", decision = form.get("decision") || "", note = form.get("note") || "";
  const feedback = (title: string, message: string, status: number) => page(title, `<p>${message}</p>${note ? `<label for="submitted-note">Nota enviada para consulta</label><textarea id="submitted-note" readonly>${escapeHtml(note)}</textarea>` : ""}<p><a href="/gestao-editorial/denuncias">Voltar às denúncias</a></p>`, status);
  if (!uuid.test(id) || !["RESOLVED", "DISMISSED"].includes(decision) || note.trim().length < 5 || note.trim().length > 1000 || ["id", "decision", "note", "csrf"].some(key => form.getAll(key).length > 1)) return feedback("Solicitação inválida", "Confira os dados da análise.", 400);
  try {
    const response = await upstream(`/reports/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: decision, ...(note.trim() && { note: note.trim() }) }) });
    if (response.status === 401) return denied();
    if (response.status === 403) return forbidden();
    if (response.status === 404) return feedback("Denúncia indisponível", "A denúncia não foi encontrada.", 404);
    if (response.status === 409) return feedback("Denúncia alterada", "Esta denúncia já foi analisada. Atualize a fila.", 409);
    if (response.status === 400) return feedback("Solicitação inválida", "Confira os dados da análise e tente novamente.", 400);
    if (response.status === 429) return feedback("Muitas tentativas", "Aguarde antes de tentar novamente.", 429);
    if (response.status !== 200) throw new Error("upstream");
    const value: unknown = await response.json();
    if (!record(value) || value.id !== id || value.status !== decision) throw new Error("invalid response");
    return new Response(null, { status: 303, headers: { Location: "/gestao-editorial/denuncias?resultado=registrado", "Cache-Control": "no-store, private" } });
  } catch { return feedback("Resultado incerto", "Não foi possível confirmar a decisão. Confira a fila antes de tentar novamente.", 503); }
}
