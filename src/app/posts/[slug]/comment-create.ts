type AuthFetch = (subject: string, path: string, init: RequestInit) => Promise<Response>;
export type CreateResult = "created" | "invalid" | "unauthorized" | "disabled" | "missing" | "changed" | "rate-limited" | "uncertain";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function createComment(fetchForSubject: AuthFetch, subject: string, postId: string, content: string, replyToId?: string): Promise<CreateResult> {
  if (!uuid(subject) || !uuid(postId) || (replyToId !== undefined && !uuid(replyToId)) || !/\S/u.test(content) || content.length > 1000) return "invalid";
  try {
    const response = await fetchForSubject(subject, `/api/v1/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, ...(replyToId && { replyToId }) }) });
    if (response.status === 400) return "invalid";
    if (response.status === 401) return "unauthorized";
    if (response.status === 403) return "disabled";
    if (response.status === 404) return "missing";
    if (response.status === 409) return "changed";
    if (response.status === 429) return "rate-limited";
    if (response.status !== 201) return "uncertain";
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return "uncertain";
    const item = value as Record<string, unknown>;
    if (!uuid(item.id) || item.postId !== postId || (replyToId ? item.rootId !== replyToId || item.replyToId !== replyToId : item.rootId !== null || item.replyToId !== null) || item.isActive !== true || !item.author || typeof item.author !== "object" || !("id" in item.author) || item.author.id !== subject || typeof item.content !== "string") return "uncertain";
    return "created";
  } catch { return "uncertain"; }
}
