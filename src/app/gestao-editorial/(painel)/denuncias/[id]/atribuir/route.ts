import { cookies } from "next/headers";
import { adminActor, cookieName, formBody, getSession, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return reply(404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return reply(401);
  const { id } = await params, form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return reply(403);

  if (!uuid.test(id) || ["csrf", "moderatorId"].some(key => form.getAll(key).length > 1)) {
    return reply(400);
  }

  let moderatorId = (form.get("moderatorId") || "").trim();
  if (!moderatorId) {
    const actor = await adminActor(session.token);
    if (!actor) return reply(403);
    moderatorId = actor.id;
  }

  if (!uuid.test(moderatorId)) return reply(400);

  try {
    const response = await upstream(`/reports/${id}/assign`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ moderatorId }),
    });

    if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
    if (response.status !== 200) return reply(503);

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || result.id !== id || !("status" in result) || result.status !== "IN_REVIEW") {
      return reply(503);
    }

    return reply(204);
  } catch {
    return reply(503);
  }
}
