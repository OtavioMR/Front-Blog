import { cookies } from "next/headers";
import { adminActor, cookieName, formBody, getSession, getValidSession, sameSecret } from "@/lib/admin-security";

export const runtime = "nodejs";
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return reply(404);
  const id = (await cookies()).get(cookieName)?.value;
  const form = await formBody(request);
  if (!form || form.getAll("csrf").length !== 1 || [...form.keys()].some(key => key !== "csrf")) return reply(403);
  const current = await getSession(id);
  if (!current) return reply(401);
  if (!sameSecret(form.get("csrf") ?? undefined, current.csrf)) return reply(403);
  try {
    const session = await getValidSession(id);
    if (!session) return reply(401);
    if (!(await adminActor(session.token))) return reply(401);
    return reply(204);
  } catch { return reply(503); }
}
