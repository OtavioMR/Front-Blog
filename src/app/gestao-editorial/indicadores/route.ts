import { cookies } from "next/headers";
import { cookieName, escapeHtml, getSession, page, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export async function GET() {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
  try {
    const response = await upstream("/admin/analytics/overview", { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return page("Acesso negado", '<p>Entre com uma conta autorizada.</p><a href="/gestao-editorial/entrar">Entrar</a>', 401);
    if (response.status === 403) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if (!response.ok) throw new Error("upstream");
    const value: unknown = await response.json();
    if (!object(value) || !object(value.users) || !object(value.posts) || !object(value.comments) || !object(value.reports)
      || ![value.users.total, value.users.active, value.users.verified, value.posts.total, value.posts.published, value.posts.drafts, value.comments.total, value.comments.active, value.reports.total, value.reports.pending].every(count)
      || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) throw new Error("invalid");
    const groups = [
      ["Usuários", [["Total", value.users.total], ["Ativos", value.users.active], ["E-mail confirmado", value.users.verified]]],
      ["Artigos", [["Total", value.posts.total], ["Publicados e ativos", value.posts.published], ["Rascunhos ativos", value.posts.drafts]]],
      ["Comentários", [["Total", value.comments.total], ["Ativos", value.comments.active]]],
      ["Denúncias", [["Total", value.reports.total], ["Pendentes", value.reports.pending]]],
    ] as const;
    const sections = groups.map(([title, rows]) => `<section><h2>${title}</h2><dl>${rows.map(([label, amount]) => `<dt>${label}</dt><dd>${amount}</dd>`).join("")}</dl></section>`).join("");
    return page("Indicadores", `<p>Contagens informadas pela API em <time datetime="${escapeHtml(value.generatedAt)}">${escapeHtml(value.generatedAt)}</time>.</p>${sections}<p><a href="/gestao-editorial">Voltar à revisão editorial</a></p>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar os indicadores.</p>", 503); }
}
