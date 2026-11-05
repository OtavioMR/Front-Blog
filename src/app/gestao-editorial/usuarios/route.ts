import { cookies } from "next/headers";
import { cookieName, escapeHtml, getSession, page, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export async function GET(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  const query = new URL(request.url).searchParams, rawPage = query.get("page") || "1";
  if (query.getAll("page").length > 1 || !/^[1-9]\d{0,5}$/.test(rawPage)) return page("Página inválida", "<p>Confira o número da página.</p>", 400);
  try {
    const response = await upstream(`/users?page=${rawPage}&limit=20`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
    if (response.status === 403) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if (!response.ok) throw new Error("upstream");
    const value: unknown = await response.json();
    if (!object(value) || !Array.isArray(value.data) || value.data.length > 20 || !object(value.meta) || value.meta.page !== Number(rawPage)
      || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean"
      || (rawPage === "1" && value.meta.hasPreviousPage) || (rawPage === "999999" && value.meta.hasNextPage)
      || value.data.some(item => !object(item) || typeof item.id !== "string" || !uuid.test(item.id) || typeof item.name !== "string" || item.name.length > 100
        || typeof item.email !== "string" || item.email.length > 255 || !["READER", "AUTHOR", "ADMIN"].includes(String(item.role)) || item.isActive !== true || typeof item.emailVerified !== "boolean")) throw new Error("invalid");
    const users = value.data.map(item => `<article><h2>${escapeHtml(item.name)}</h2><p>Identificador: ${escapeHtml(item.id)}</p><p>E-mail: ${escapeHtml(item.email)}</p><p>Papel: ${escapeHtml(item.role)} · E-mail ${item.emailVerified ? "confirmado" : "não confirmado"}</p></article>`).join("");
    const navigation = `<nav aria-label="Paginação">${value.meta.hasPreviousPage ? `<a href="?page=${Number(rawPage) - 1}">Anterior</a> ` : ""}Página ${rawPage}${value.meta.hasNextPage ? ` <a href="?page=${Number(rawPage) + 1}">Próxima</a>` : ""}</nav>`;
    return page("Usuários ativos", `<p>Esta lista contém apenas contas ativas. Contas suspensas e ações de moderação não estão disponíveis aqui.</p>${users || "<p>Nenhuma conta nesta página.</p>"}${navigation}<p><a href="/gestao-editorial">Voltar à revisão editorial</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar os usuários.</p>", 503); }
}
