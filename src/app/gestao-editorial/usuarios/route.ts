import { cookies } from "next/headers";
import { cookieName, escapeHtml, getSession, page, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const roles = ["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"];

export async function GET(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const query = new URL(request.url).searchParams, rawPage = query.get("page") || "1", search = (query.get("search") || "").trim();
  const role = query.get("role") || "", status = query.get("status") || "", sort = query.get("sort") || "createdAt", order = query.get("order") || "DESC";
  if (["page", "search", "role", "status", "sort", "order"].some(key => query.getAll(key).length > 1) || !/^[1-9]\d{0,5}$/.test(rawPage) || search.length > 255 || (role && !roles.includes(role)) || !["", "active", "suspended", "inactive"].includes(status) || !["createdAt", "name"].includes(sort) || !["ASC", "DESC"].includes(order)) return page("Filtros inválidos", "<p>Confira os filtros e o número da página.</p>", 400);
  const params = new URLSearchParams({ page: rawPage, limit: "20" });
  if (search) params.set("search", search);
  if (role) params.set("role", role);
  if (status) params.set("status", status);
  if (sort !== "createdAt") params.set("sort", sort);
  if (order !== "DESC") params.set("order", order);
  try {
    const response = await upstream(`/admin/users?${params}`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return page("Sessão expirada", '<p>Entre novamente para continuar.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
    if (response.status === 403) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if (!response.ok) throw new Error("upstream");
    const value: unknown = await response.json();
    if (!object(value) || !Array.isArray(value.data) || value.data.length > 20 || !object(value.meta) || value.meta.page !== Number(rawPage)
      || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean"
      || (rawPage === "1" && value.meta.hasPreviousPage) || (rawPage === "999999" && value.meta.hasNextPage)
      || value.data.some(item => !object(item) || typeof item.id !== "string" || !uuid.test(item.id) || typeof item.name !== "string" || item.name.length > 255
        || typeof item.email !== "string" || item.email.length > 255 || !roles.includes(String(item.role)) || typeof item.isActive !== "boolean" || typeof item.moderationSuspended !== "boolean" || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)))) throw new Error("invalid");
    const users = value.data.map(item => `<article><h2>${escapeHtml(item.name)}</h2><p>E-mail: ${escapeHtml(item.email)}</p><p>Papel: ${escapeHtml(item.role)} · ${item.moderationSuspended ? "Suspenso" : item.isActive ? "Ativo" : "Inativo"}</p><p>Cadastro: <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(item.createdAt)}</time></p><p><a href="/gestao-editorial/usuarios/${item.id}">Ver conta</a></p></article>`).join("");
    const options = (entries: [string, string][], selected: string) => entries.map(([v, label]) => `<option value="${v}"${v === selected ? " selected" : ""}>${label}</option>`).join("");
    const filters = `<form method="get"><label for="search">Buscar nome, e-mail ou identificador</label><input id="search" name="search" maxlength="255" value="${escapeHtml(search)}"><label for="role">Papel</label><select id="role" name="role">${options([["", "Todos"], ...roles.map(r => [r, r] as [string, string])], role)}</select><label for="status">Situação</label><select id="status" name="status">${options([["", "Todas"], ["active", "Ativa"], ["suspended", "Suspensa"], ["inactive", "Inativa"]], status)}</select><label for="sort">Ordenar por</label><select id="sort" name="sort">${options([["createdAt", "Cadastro"], ["name", "Nome"]], sort)}</select><label for="order">Ordem</label><select id="order" name="order">${options([["DESC", "Decrescente"], ["ASC", "Crescente"]], order)}</select><button>Filtrar</button></form>`;
    const link = (n: number) => { const p = new URLSearchParams(params); p.delete("limit"); p.set("page", String(n)); return `?${escapeHtml(p.toString())}`; };
    const navigation = `<nav aria-label="Paginação">${value.meta.hasPreviousPage ? `<a href="${link(Number(rawPage) - 1)}">Anterior</a> ` : ""}Página ${rawPage}${value.meta.hasNextPage ? ` <a href="${link(Number(rawPage) + 1)}">Próxima</a>` : ""}</nav>`;
    return page("Usuários", `${filters}${users || "<p>Nenhuma conta nesta página.</p>"}${navigation}<p><a href="/gestao-editorial">Voltar à revisão editorial</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar os usuários.</p>", 503); }
}
