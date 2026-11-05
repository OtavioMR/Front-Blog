export type CommentLikeStatus = { liked: boolean; likes: number };
export function parseCommentLike(value: unknown): CommentLikeStatus {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("liked" in value) || typeof value.liked !== "boolean" || !("likes" in value) || !Number.isSafeInteger(value.likes) || (value.likes as number) < 0) throw new Error("Curtidas indisponíveis.");
  return value as CommentLikeStatus;
}
