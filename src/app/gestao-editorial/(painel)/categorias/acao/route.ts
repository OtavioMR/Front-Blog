import { cookies } from "next/headers";
import { cookieName, formBody, getSession, getValidSession, sameSecret, upstream } from "@/lib/admin-security";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_BFF !== "true") return reply(404);
  const sessionId = (await cookies()).get(cookieName)?.value;
  const current = getSession(sessionId);
  if (!current) return reply(401);
  const form = await formBody(request);
  if (!form || !sameSecret(form.get("csrf") ?? undefined, current.csrf)) return reply(403);
  const session = await getValidSession(sessionId).catch(() => undefined);
  if (session === undefined) return reply(503);
  if (!session) return reply(401);
  const action = form.get("action") || "";
  const id = form.get("id") || "";
  const name = (form.get("name") || "").trim();
  const slug = (form.get("slug") || "").trim();
  const description = (form.get("description") || "").trim();

  if (["action", "id", "name", "slug", "description", "csrf"].some(key => form.getAll(key).length > 1) || !["create", "edit", "delete", "reactivate"].includes(action)) return reply(400);

  try {
    if (action === "create") {
      if (name.length < 2 || name.length > 100 || description.length > 255) return reply(400);
      const response = await upstream("/categories", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(description ? { description } : {}) }),
      });
      if ([400, 401, 403, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 201) return reply(503);
      return reply(204);
    }

    if (!uuid.test(id)) return reply(400);

    if (action === "edit") {
      if (name.length < 2 || name.length > 100 || slug.length < 2 || slug.length > 120 || description.length > 255) return reply(400);
      const response = await upstream(`/categories/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, ...(description ? { description } : {}) }),
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 200) return reply(503);
      return reply(204);
    }

    if (action === "delete") {
      const response = await upstream(`/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 204 && response.status !== 200) return reply(503);
      return reply(204);
    }

    if (action === "reactivate") {
      const response = await upstream(`/categories/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status)) return reply(response.status);
      if (response.status !== 200) return reply(503);
      return reply(204);
    }

    return reply(400);
  } catch {
    return reply(503);
  }
}
