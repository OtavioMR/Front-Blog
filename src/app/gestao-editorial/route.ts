import { cookies } from "next/headers";
import sanitizeHtml from "sanitize-html";
import { cookieName, deleteSession, escapeHtml, formBody, getSession, page, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied = () => page("Acesso negado", "<p>Entre com uma conta autorizada.</p><a href=\"/gestao-editorial/entrar\">Entrar</a>", 401);
export async function GET() {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return denied();
  try {
    const response = await upstream("/post-reviews", { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return denied();
    if (response.status === 403) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if (!response.ok) throw new Error("unavailable");
    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length > 100 || data.some(item => !item || typeof item !== "object" || !idPattern.test(item.id) || typeof item.title !== "string" || typeof item.content !== "string")) throw new Error("invalid");
    const articles = data.map(item => {
      const content = sanitizeHtml(item.content, { allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3"], allowedAttributes: {} });
      const actions = ["APPROVED", "REJECTED"].map(decision => `<form method="post" class="inline"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="id" value="${item.id}"><input type="hidden" name="decision" value="${decision}">${decision === "REJECTED" ? `<label for="reason-${item.id}">Justificativa da rejeição</label><textarea id="reason-${item.id}" name="reason" required minlength="5" maxlength="1000"></textarea>` : ""}<button>${decision === "APPROVED" ? "Aprovar e publicar" : "Rejeitar"}</button></form>`).join("");
      return `<article><h2>${escapeHtml(item.title)}</h2>${content}${actions}</article>`;
    }).join("");
    return page("Revisão editorial", `<p>Os primeiros artigos aguardam decisão.</p><p><a href="/gestao-editorial/denuncias">Denúncias pendentes</a> · <a href="/gestao-editorial/categorias">Categorias</a> · <a href="/gestao-editorial/usuarios">Usuários ativos</a> · <a href="/gestao-editorial/indicadores">Indicadores</a></p>${articles || "<p>Nenhum artigo aguardando revisão.</p>"}<form method="post"><input type="hidden" name="csrf" value="${session.csrf}"><input type="hidden" name="action" value="logout"><button>Sair</button></form>`);
  } catch { return page("Serviço indisponível", "<p>Não foi possível carregar a revisão agora.</p>", 503); }
}
export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const jar = await cookies(); const id = jar.get(cookieName)?.value; const session = getSession(id);
  if (!session) return denied();
  const form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return page("Acesso negado", "<p>Solicitação inválida.</p>", 403);
  if (["csrf", "action", "id", "decision", "reason"].some(key => form.getAll(key).length > 1)) return page("Solicitação inválida", "<p>Confira a decisão.</p>", 400);
  if (form.get("action") === "logout") {
    deleteSession(id); jar.set(cookieName, "", { ...options, maxAge: 0 });
    try { const result = await upstream("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${session.token}` } }); if (!result.ok) throw new Error("uncertain"); }
    catch { return page("Saída local concluída", "<p>Não foi possível confirmar a revogação no servidor.</p>", 503); }
    return new Response(null, { status: 303, headers: { Location: "/gestao-editorial/entrar", "Cache-Control": "no-store, private" } });
  }
  const postId = form.get("id") || "", decision = form.get("decision") || "", reason = (form.get("reason") || "").trim();
  if (!idPattern.test(postId) || !["APPROVED", "REJECTED"].includes(decision) || (decision === "REJECTED" && (reason.length < 5 || reason.length > 1000)) || (decision === "APPROVED" && reason)) return page("Solicitação inválida", "<p>Confira a decisão e a justificativa.</p>", 400);
  try {
    const response = await upstream(`/post-reviews/${postId}/decision`, { method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ decision, ...(decision === "REJECTED" && { reason }) }) });
    if (response.status === 401) return denied();
    if (response.status === 403) return page("Acesso negado", "<p>Esta conta não possui permissão.</p>", 403);
    if (response.status === 400) return page("Solicitação inválida", "<p>Confira a decisão.</p>", 400);
    if (response.status === 404) return page("Artigo indisponível", "<p>O artigo não foi encontrado. Atualize a fila.</p>", 404);
    if (response.status === 409) return page("Revisão alterada", "<p>O artigo já foi alterado. Atualize a fila.</p>", 409);
    if (response.status === 429) return page("Muitas tentativas", "<p>Aguarde antes de tentar novamente.</p>", 429);
    if (response.status !== 201) throw new Error("uncertain");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== decision) throw new Error("uncertain");
    return new Response(null, { status: 303, headers: { Location: "/gestao-editorial", "Cache-Control": "no-store, private" } });
  } catch { return page("Serviço indisponível", "<p>Não foi possível confirmar a decisão. Confira a fila antes de tentar novamente.</p>", 503); }
}
