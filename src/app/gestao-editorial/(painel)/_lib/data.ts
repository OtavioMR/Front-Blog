import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { adminActor, cookieName, getValidSession, refreshAfterUnauthorized, upstream, type AdminActorInfo } from "@/lib/admin-security";

export type { AdminActorInfo };
export type AdminResult = { ok: true; value: unknown } | { ok: false; reason: "session" | "forbidden" | "missing" | "unavailable" };

export async function adminRead(path: "/admin/analytics/overview" | "/admin/analytics/newsletter" | "/admin/analytics/activity"): Promise<AdminResult> {
  return read(path);
}

export async function adminAuditRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/admin/audit-logs?${query}`);
}
export async function adminReportsRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/reports?${query}`);
}
export async function adminUsersRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/admin/users?${query}`);
}
export async function adminBlockedAuthors(page: number, limit = 10, search = "", filter: "requested" | "all" = "all"): Promise<AdminResult> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), filter });
  if (search) query.set("search", search);
  return read(`/admin/users/author-access/blocked?${query}`);
}
export async function adminUserDetail(id: string): Promise<AdminResult> {
  return read(`/admin/users/${id}`);
}
export async function adminUserHistory(id: string, page: string): Promise<AdminResult> {
  return read(`/admin/users/${id}/moderation-history?page=${page}&limit=10`);
}
export async function adminUserReports(id: string, page: string): Promise<AdminResult> {
  return read(`/admin/users/${id}/reports?page=${page}&limit=10`);
}
export async function adminTagsRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/admin/tags?${query}`);
}
export async function adminCategoriesRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/admin/categories?${query}`);
}
export async function adminReportDetail(id: string): Promise<AdminResult> {
  return read(`/reports/${id}`);
}
export async function adminReportHistory(id: string, page: string): Promise<AdminResult> {
  return read(`/reports/${id}/history?page=${page}&limit=10`);
}
// Uma consulta por requisição; o cargo vem sempre da API, nunca do cookie ou do token decodificado.
export const adminIdentity = cache(async () => {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  const sessionId = (await cookies()).get(cookieName)?.value;
  const session = await getValidSession(sessionId);
  if (!session) return null;
  const token = session.token;
  const actor = await adminActor(token);
  if (actor) return actor;
  const renewed = await refreshAfterUnauthorized(sessionId, token);
  return renewed ? adminActor(renewed.token) : null;
});
export async function adminSessionExpiry(): Promise<number | null> {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  return (await getValidSession((await cookies()).get(cookieName)?.value))?.expires ?? null;
}
export async function adminCommentsRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/admin/comments?${query}`);
}
export async function adminCommentDetail(id: string): Promise<AdminResult> {
  return read(`/admin/comments/${id}`);
}
export async function adminCommentHistory(id: string, page: string): Promise<AdminResult> {
  return read(`/admin/comments/${id}/history?page=${page}&limit=10`);
}
export async function adminPostsRead(query: URLSearchParams): Promise<AdminResult> {
  return read(`/admin/posts?${query}`);
}
export async function adminPostDetail(id: string): Promise<AdminResult> {
  return read(`/admin/posts/${id}`);
}
export async function adminPostHistory(id: string, page: string): Promise<AdminResult> {
  return read(`/admin/posts/${id}/history?page=${page}&limit=10`);
}
export async function adminCsrf(): Promise<string | null> {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  return (await getValidSession((await cookies()).get(cookieName)?.value))?.csrf ?? null;
}

async function read(path: string): Promise<AdminResult> {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  const sessionId = (await cookies()).get(cookieName)?.value;
  let session = await getValidSession(sessionId);
  if (!session) return { ok: false, reason: "session" };
  try {
    const rejectedToken = session.token;
    let response = await upstream(path, { headers: { Authorization: `Bearer ${rejectedToken}` } });
    if (response.status === 401) {
      session = await refreshAfterUnauthorized(sessionId, rejectedToken);
      if (!session) return { ok: false, reason: "session" };
      response = await upstream(path, { headers: { Authorization: `Bearer ${session.token}` } });
    }
    if (response.status === 401) return { ok: false, reason: "session" };
    if (response.status === 403) return { ok: false, reason: "forbidden" };
    if (response.status === 404) return { ok: false, reason: "missing" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, value: await response.json() };
  } catch { return { ok: false, reason: "unavailable" }; }
}

export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
