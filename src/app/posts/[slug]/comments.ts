export type Comment = { id: string; postId: string; rootId: string | null; author: { name: string }; content: string; isActive: boolean; createdAt: string; editedAt: string | null };
type RootComment = Comment & { replies: { data: Comment[]; meta: { total: number } } };
type CommentPage = { data: RootComment[]; meta: { page: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } };
export type CommentsResult = { kind: "available"; page: CommentPage } | { kind: "disabled" } | { kind: "unavailable" };

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
function comment(value: unknown, postId: string, rootId: string | null): value is Comment {
  return record(value) && uuid(value.id) && value.postId === postId && value.rootId === rootId && record(value.author) && typeof value.author.name === "string" && typeof value.content === "string" && typeof value.isActive === "boolean" && date(value.createdAt) && (value.editedAt === null || date(value.editedAt));
}
function rootComment(value: unknown, postId: string): boolean {
  if (!record(value) || !record(value.replies)) return false;
  const data = value.replies.data;
  const meta = value.replies.meta;
  if (!Array.isArray(data) || !record(meta)) return false;
  return comment(value, postId, null) && data.every((reply: unknown) => comment(reply, postId, value.id)) && Number.isSafeInteger(meta.total) && (meta.total as number) >= data.length;
}
function parsePage(value: unknown, postId: string, page: number): CommentPage {
  if (!record(value) || !Array.isArray(value.data) || !value.data.every((root: unknown) => rootComment(root, postId))
    || !record(value.meta) || value.meta.page !== page || !Number.isSafeInteger(value.meta.totalPages) || (value.meta.totalPages as number) < 0 || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean") throw new Error("Resposta de comentários inválida.");
  return value as CommentPage;
}
export function commentsPage(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Number(value);
}
export async function getComments(postId: string | undefined, page: number): Promise<CommentsResult> {
  if (!uuid(postId)) return { kind: "unavailable" };
  try {
    const origin = process.env.API_ORIGIN || "http://localhost:3001";
    const response = await fetch(`${origin}/api/v1/posts/${postId}/comments?page=${page}&limit=10`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (response.status === 403) return { kind: "disabled" };
    if (!response.ok) return { kind: "unavailable" };
    return { kind: "available", page: parsePage(await response.json(), postId, page) };
  } catch { return { kind: "unavailable" }; }
}
