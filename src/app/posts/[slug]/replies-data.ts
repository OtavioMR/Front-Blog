import type { Comment } from "./comments";

type ReplyPage = { data: Comment[]; meta: { page: number; total: number; hasNextPage: boolean } };
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

export async function fetchReplies(postId: string, rootId: string, page: number): Promise<ReplyPage> {
  if (!uuid(postId) || !uuid(rootId) || !Number.isSafeInteger(page) || page < 1) throw new Error("Conversa inválida.");
  const response = await fetch(`/api/v1/posts/${postId}/comments/${rootId}/replies?page=${page}&limit=5`, { cache: "no-store", credentials: "omit", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Respostas indisponíveis.");
  const value: unknown = await response.json();
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(item => record(item) && uuid(item.id) && item.postId === postId && item.rootId === rootId && record(item.author) && typeof item.author.name === "string" && typeof item.content === "string" && typeof item.isActive === "boolean" && validDate(item.createdAt) && (item.editedAt === null || validDate(item.editedAt))) || !record(value.meta) || value.meta.page !== page || !Number.isSafeInteger(value.meta.total) || (value.meta.total as number) < 0 || typeof value.meta.hasNextPage !== "boolean") throw new Error("Resposta inválida.");
  return value as ReplyPage;
}
