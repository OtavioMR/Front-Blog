import { cookies } from "next/headers";
import { cookieName, deleteSession, formBody, getSession, logoutUpstream, page, sameSecret } from "@/lib/admin-security";

export const runtime = "nodejs";
// Encerra apenas a sessão administrativa; a conta comum do blog (cookie próprio) não é afetada.
export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return page("Página não encontrada", "<p>Esta página não está disponível.</p>", 404);
  const jar = await cookies(); const id = jar.get(cookieName)?.value; const current = getSession(id);
  if (!current) return new Response(null, { status: 303, headers: { Location: "/gestao-editorial/entrar", "Cache-Control": "no-store, private" } });
  const form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, current.csrf)) return page("Acesso negado", "<p>Solicitação inválida.</p>", 403);
  const revocation = logoutUpstream(current);
  // Revoke the opaque ID immediately, but never send a fixed-name cookie deletion:
  // a delayed logout response could otherwise erase a newer administrative login.
  deleteSession(id);
  try { const result = await revocation; if (!result.ok) throw new Error("uncertain"); }
  catch { return page("Saída local concluída", "<p>Não foi possível confirmar a revogação no servidor.</p><p><a href=\"/gestao-editorial/entrar\">Voltar à entrada</a></p>", 503); }
  return new Response(null, { status: 303, headers: { Location: "/gestao-editorial/entrar", "Cache-Control": "no-store, private" } });
}
