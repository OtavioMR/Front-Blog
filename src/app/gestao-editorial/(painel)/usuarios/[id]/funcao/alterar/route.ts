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
  const role = form.get("role"), reason = (form.get("reason") || "").trim(), code = form.get("code") || "";
  if (!uuid.test(id) || ["csrf", "role", "reason", "code"].some(key => form.getAll(key).length !== 1) || !["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(role || "") || reason.length < 5 || reason.length > 1000 || !/^\d{6}$/.test(code)) return reply(400);
  try {
    const response = await upstream(`/admin/users/${id}/role`, { method: "PATCH", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json", "X-TOTP-Code": code }, body: JSON.stringify({ role, reason }) });
    if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
    if (response.status !== 200) return reply(503);
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("id" in value) || value.id !== id || !("role" in value) || value.role !== role) return reply(503);
    return reply(204);
  } catch { return reply(503); }
}
