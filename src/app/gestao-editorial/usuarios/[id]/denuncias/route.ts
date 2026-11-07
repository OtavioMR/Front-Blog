import { cookies } from "next/headers";
import { cookieName, escapeHtml, getSession, page, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const { id } = await params, query = new URL(request.url).searchParams, rawPage = query.get("page") || "1";
  if (!uuid.test(id) || query.getAll("page").length > 1 || !/^[1-9]\d{0,5}$/.test(rawPage)) return page("Solicitação inválida", "<p>Confira o endereço e a página.</p>", 400);
  try {
    const response = await upstream(`/admin/users/${id}/reports?page=${rawPage}&limit=10`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
    if (response.status === 403) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if (response.status === 404) return page("Conta indisponível", "<p>Esta conta não foi encontrada.</p>", 404);
    if (!response.ok) throw new Error("upstream");
    const value: unknown = await response.json();
    if (!object(value) || !Array.isArray(value.data) || value.data.length > 10 || !object(value.meta) || value.meta.page !== Number(rawPage)
      || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean" || (rawPage === "1" && value.meta.hasPreviousPage) || (rawPage === "999999" && value.meta.hasNextPage)
      || value.data.some(row => !object(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.reason !== "string" || row.reason.length > 1000 || !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(row.status)) || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt)))) throw new Error("invalid");
    const entries = value.data.map(row => `<li><a href="/gestao-editorial/denuncias/${row.id}">Denúncia ${escapeHtml(row.id)}</a> · ${escapeHtml(row.status)} · ${escapeHtml(row.createdAt)}<p>${escapeHtml(row.reason)}</p></li>`).join("");
    const navigation = `<nav aria-label="Paginação">${value.meta.hasPreviousPage ? `<a href="?page=${Number(rawPage) - 1}">Anterior</a> ` : ""}Página ${rawPage}${value.meta.hasNextPage ? ` <a href="?page=${Number(rawPage) + 1}">Próxima</a>` : ""}</nav>`;
    return page("Denúncias relacionadas", `<p>Denúncias do perfil, dos artigos e dos comentários desta conta.</p>${entries ? `<ul>${entries}</ul>` : "<p>Nenhuma denúncia nesta página.</p>"}${navigation}<p><a href="/gestao-editorial/usuarios/${id}">Voltar à conta</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar as denúncias relacionadas.</p>", 503); }
}
