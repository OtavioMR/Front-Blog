import { cookies } from "next/headers";
import { cookieName, formBody, getSession, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return reply(404);
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return reply(401);
  const { id } = await params, form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, session.csrf)) return reply(403);

  const action = form.get("action") || "";
  const reason = (form.get("reason") || "").trim();
  const endsAt = (form.get("endsAt") || "").trim();

  if (!uuid.test(id) || ["csrf", "action", "reason", "endsAt"].some(key => form.getAll(key).length > 1) || !["suspend", "restore", "revoke-sessions"].includes(action)) {
    return reply(400);
  }

  try {
    if (action === "suspend") {
      if (reason.length < 5 || reason.length > 1000) return reply(400);
      if (endsAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(endsAt) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.now())) {
        return reply(400);
      }
      const response = await upstream(`/admin/users/${id}/suspension`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason, ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}) }),
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 201) return reply(503);
      return reply(204);
    }

    if (action === "restore") {
      const response = await upstream(`/admin/users/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 201) return reply(503);
      return reply(204);
    }

    if (action === "revoke-sessions") {
      if (reason.length < 5 || reason.length > 1000) return reply(400);
      const response = await upstream(`/admin/users/${id}/sessions/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 201) return reply(503);
      return reply(204);
    }

    return reply(400);
  } catch {
    return reply(503);
  }
}
