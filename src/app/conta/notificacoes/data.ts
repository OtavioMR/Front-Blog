const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const noticeTypes = ["post_like", "comment", "reply", "comment_like", "follow", "post_approved", "post_rejected", "post_hidden", "post_restored", "comment_hidden", "comment_restored", "role_changed", "sessions_revoked", "account_suspended", "account_restored", "report_assigned"] as const;
export type Notice = { id: string; type: typeof noticeTypes[number]; postId: string | null; commentId: string | null; readAt: string | null; createdAt: string; actor: { id: string; name: string } };
export type Notifications = { data: Notice[]; unread: number; meta: { page: number; hasNextPage: boolean; hasPreviousPage: boolean } };
export function parseNotifications(value: unknown, page: number): Notifications {
  if (!record(value) || !record(value.meta) || value.meta.page !== page || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean" || !Number.isInteger(value.unread) || (value.unread as number) < 0 || !Array.isArray(value.data) || value.data.length > 10 || !value.data.every((item: unknown) => record(item) && typeof item.id === "string" && uuid.test(item.id) && typeof item.type === "string" && (noticeTypes as readonly string[]).includes(item.type) && (item.postId === null || (typeof item.postId === "string" && uuid.test(item.postId))) && (item.commentId === null || (typeof item.commentId === "string" && uuid.test(item.commentId))) && (item.readAt === null || date(item.readAt)) && date(item.createdAt) && record(item.actor) && typeof item.actor.id === "string" && uuid.test(item.actor.id) && typeof item.actor.name === "string")) throw new Error("Notificações inválidas.");
  return value as Notifications;
}
