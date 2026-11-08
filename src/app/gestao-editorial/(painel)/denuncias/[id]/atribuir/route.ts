import { cookies } from "next/headers";
import { cookieName, formBody, getSession, getValidSession, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return reply(404);
  const sessionId = (await cookies()).get(cookieName)?.value;
  const current = getSession(sessionId);
  if (!current) return reply(401);
  const { id } = await params, form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, current.csrf)) return reply(403);
  const session = await getValidSession(sessionId).catch(() => undefined);
  if (session === undefined) return reply(503);
  if (!session) return reply(401);

  if (!uuid.test(id) || form.getAll("csrf").length !== 1 || form.getAll("release").length > 1 || form.getAll("moderatorId").length > 1 || [...form.keys()].some(key => key !== "csrf" && key !== "release" && key !== "moderatorId") || (form.has("release") && (form.get("release") !== "true" || form.has("moderatorId"))) || (form.has("moderatorId") && !uuid.test(form.get("moderatorId") || ""))) {
    return reply(400);
  }

  try {
    const response = await upstream(`/reports/${id}/assign`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form.has("release") ? { release: true } : form.has("moderatorId") ? { moderatorId: form.get("moderatorId") } : {}),
    });

    if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
    if (response.status !== 200) return reply(503);

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || result.id !== id || !("status" in result) || result.status !== (form.has("release") ? "PENDING" : "IN_REVIEW")) {
      return reply(503);
    }

    return reply(204);
  } catch {
    return reply(503);
  }
}
