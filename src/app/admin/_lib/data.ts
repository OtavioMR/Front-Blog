import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { adminActor, cookieName, getSession, upstream } from "@/lib/admin-security";

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
export async function adminIdentity() {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  const session = getSession((await cookies()).get(cookieName)?.value);
  return session ? adminActor(session.token) : null;
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
  return getSession((await cookies()).get(cookieName)?.value)?.csrf ?? null;
}

async function read(path: string): Promise<AdminResult> {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  const session = getSession((await cookies()).get(cookieName)?.value);
  if (!session) return { ok: false, reason: "session" };
  try {
    const response = await upstream(path, { headers: { Authorization: `Bearer ${session.token}` } });
    if (response.status === 401) return { ok: false, reason: "session" };
    if (response.status === 403) return { ok: false, reason: "forbidden" };
    if (response.status === 404) return { ok: false, reason: "missing" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, value: await response.json() };
  } catch { return { ok: false, reason: "unavailable" }; }
}

export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
