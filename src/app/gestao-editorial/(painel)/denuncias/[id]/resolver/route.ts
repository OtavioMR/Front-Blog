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

  const status = form.get("status") || "";
  const action = form.get("action") || "NONE";
  const note = (form.get("note") || "").trim();

  if (
    !uuid.test(id) ||
    ["csrf", "status", "action", "note"].some(key => form.getAll(key).length !== 1) ||
    !["RESOLVED", "DISMISSED"].includes(status) ||
    !["NONE", "HIDE_POST", "HIDE_COMMENT"].includes(action) ||
    (status === "DISMISSED" && action !== "NONE") ||
    note.length < 5 ||
    note.length > 1000
  ) {
    return reply(400);
  }

  try {
    const response = await upstream(`/reports/${id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status, note, action }),
    });

    if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
    if (response.status !== 201) return reply(503);

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || result.id !== id || !("status" in result) || result.status !== status) {
      return reply(503);
    }

    return reply(204);
  } catch {
    return reply(503);
  }
}
