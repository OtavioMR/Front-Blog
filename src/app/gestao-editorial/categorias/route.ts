import { cookies } from "next/headers";
import { cookieName, escapeHtml, formBody, getSession, page, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied = () => page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
const forbidden = () => page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
const missing = () => page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export async function GET(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return missing();
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return denied();
  const query = new URL(request.url).searchParams, rawPage = query.get("page") || "1";
  if (query.getAll("page").length > 1 || !/^[1-9]\d{0,5}$/.test(rawPage)) return page("Página inválida", "<p>Confira o número da página.</p>", 400);
  try {
    // The category listing is public; authorize the administrative page separately.
    const authorization = await upstream("/admin/analytics/overview", { headers: { Authorization: `Bearer ${session.token}` } });
    if (authorization.status === 401) return denied();
    if (authorization.status === 403) return forbidden();
    if (!authorization.ok) throw new Error("authorization unavailable");
    const response = await upstream(`/categories?page=${rawPage}&limit=20`);
    if (!response.ok) throw new Error("categories unavailable");
    const data: unknown = await response.json();
    if (!obj(data) || !Array.isArray(data.data) || data.data.length > 20 || !obj(data.meta) || data.meta.page !== Number(rawPage)
      || typeof data.meta.hasPreviousPage !== "boolean" || typeof data.meta.hasNextPage !== "boolean"
      || (rawPage === "1" && data.meta.hasPreviousPage) || (rawPage === "999999" && data.meta.hasNextPage)
      || data.data.some(item => !obj(item) || typeof item.id !== "string" || !uuid.test(item.id) || typeof item.name !== "string" || item.name.length > 100 || typeof item.slug !== "string" || item.slug.length > 120 || !(item.description === null || (typeof item.description === "string" && item.description.length <= 255)) || item.isActive !== true)) throw new Error("invalid");
    const items = data.data.map(item => `<article><h2>${escapeHtml(item.name)}</h2><p>Endereço: ${escapeHtml(item.slug)}</p><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="id" value="${item.id}"><input type="hidden" name="action" value="edit"><label for="name-${item.id}">Nome</label><input id="name-${item.id}" name="name" required minlength="2" maxlength="100" value="${escapeHtml(item.name)}"><label for="slug-${item.id}">Endereço</label><input id="slug-${item.id}" name="slug" required minlength="2" maxlength="120" value="${escapeHtml(item.slug)}"><label for="description-${item.id}">Descrição</label><textarea id="description-${item.id}" name="description" maxlength="255">${escapeHtml(item.description || "")}</textarea><button>Salvar categoria</button></form><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="id" value="${item.id}"><input type="hidden" name="action" value="confirm-delete"><button>Desativar categoria</button></form></article>`).join("");
    const nav = `<nav aria-label="Paginação">${data.meta.hasPreviousPage ? `<a href="?page=${Number(rawPage) - 1}">Anterior</a> ` : ""}Página ${rawPage}${data.meta.hasNextPage ? ` <a href="?page=${Number(rawPage) + 1}">Próxima</a>` : ""}</nav>`;
    const notices: Record<string, string> = { create: "Categoria criada ou reativada.", edit: "Categoria atualizada.", delete: "Categoria desativada." };
    const result = query.get("resultado") || "";
    const notice = query.getAll("resultado").length === 1 && Object.hasOwn(notices, result) ? notices[result] : undefined;
    return page("Categorias", `${notice ? `<p role="status">${notice}</p>` : ""}<p>São exibidas somente categorias ativas. Criar com nome ou endereço de uma categoria desativada pode reativá-la.</p><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="action" value="create"><label for="new-name">Nome</label><input id="new-name" name="name" required minlength="2" maxlength="100"><label for="new-description">Descrição (opcional)</label><textarea id="new-description" name="description" maxlength="255"></textarea><button>Criar categoria</button></form>${items || "<p>Nenhuma categoria nesta página.</p>"}${nav}<p><a href="/gestao-editorial">Voltar à revisão editorial</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar as categorias.</p>", 503); }
}

export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return missing();
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return denied();
  const form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return forbidden();
  const action = form.get("action") || "", id = form.get("id") || "";
  if (["action", "id", "name", "slug", "description", "csrf"].some(key => form.getAll(key).length > 1) || !["create", "edit", "confirm-delete", "delete"].includes(action) || (action !== "create" && !uuid.test(id))) return page("Solicitação inválida", "<p>Confira os dados informados.</p>", 400);
  if (action === "confirm-delete") {
    // Revalidate permission even though this step does not modify data.
    try {
      const check = await upstream("/admin/analytics/overview", { headers: { Authorization: `Bearer ${session.token}` } });
      if (check.status === 401) return denied(); if (check.status === 403) return forbidden(); if (!check.ok) throw new Error();
      const target = await upstream(`/categories/${id}`);
      if (target.status === 404) return page("Categoria indisponível", "<p>A categoria não foi encontrada ou já foi desativada.</p>", 404);
      if (!target.ok) throw new Error();
      const category: unknown = await target.json();
      if (!obj(category) || category.id !== id || typeof category.name !== "string" || category.name.length > 100 || category.isActive !== true) throw new Error();
      return page("Desativar categoria?", `<p>A categoria <strong>${escapeHtml(category.name)}</strong> (${escapeHtml(id)}) deixará de aparecer na listagem pública.</p><form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="id" value="${id}"><input type="hidden" name="action" value="delete"><button>Confirmar desativação</button></form><p><a href="/gestao-editorial/categorias">Cancelar</a></p>`);
    } catch { return page("Serviço indisponível", "<p>Não foi possível confirmar a permissão.</p>", 503); }
  }
  const name = (form.get("name") || "").trim(), slug = (form.get("slug") || "").trim(), description = (form.get("description") || "").trim();
  const feedback = (title: string, message: string, status: number) => page(title, `<p>${message}</p>${action === "delete" ? "" : `<p>Dados enviados para consulta:</p><dl><dt>Nome</dt><dd>${escapeHtml(name)}</dd>${action === "edit" ? `<dt>Endereço</dt><dd>${escapeHtml(slug)}</dd>` : ""}<dt>Descrição</dt><dd>${escapeHtml(description)}</dd></dl>`}<p><a href="/gestao-editorial/categorias">Voltar às categorias</a></p>`, status);
  if (action !== "delete" && (name.length < 2 || name.length > 100 || description.length > 255 || (action === "edit" && (slug.length < 2 || slug.length > 120)))) return feedback("Solicitação inválida", "Confira o nome, o endereço e a descrição.", 400);
  try {
    const response = await upstream(action === "create" ? "/categories" : `/categories/${id}`, { method: action === "create" ? "POST" : action === "edit" ? "PATCH" : "DELETE", headers: { Authorization: `Bearer ${session.token}`, ...(action !== "delete" && { "Content-Type": "application/json" }) }, ...(action !== "delete" && { body: JSON.stringify({ name, description, ...(action === "edit" && { slug }) }) }) });
    if (response.status === 401) return denied(); if (response.status === 403) return forbidden();
    if (response.status === 404) return page("Categoria indisponível", "<p>A categoria não foi encontrada ou já foi desativada.</p>", 404);
    if (response.status === 409) return feedback("Categoria em conflito", "Nome ou endereço já está em uso. Confira a lista antes de continuar.", 409);
    if (response.status === 400) return feedback("Solicitação inválida", "Confira os dados informados.", 400);
    if (response.status === 429) return feedback("Muitas tentativas", "Aguarde antes de tentar novamente.", 429);
    if (action === "delete") {
      if (response.status !== 204) throw new Error("uncertain");
    } else {
      if (response.status !== (action === "create" ? 201 : 200)) throw new Error("uncertain");
      const result: unknown = await response.json();
      if (!obj(result) || typeof result.id !== "string" || !uuid.test(result.id)
        || (action === "edit" && result.id !== id) || result.isActive !== true
        || result.name !== name || result.description !== description) throw new Error("uncertain");
    }
    return new Response(null, { status: 303, headers: { Location: `/gestao-editorial/categorias?resultado=${action}`, "Cache-Control": "no-store, private" } });
  } catch { return feedback("Resultado incerto", "Não foi possível confirmar a operação. Confira a lista antes de tentar novamente.", 503); }
}
