type AuthFetch = (subject: string, path: string, init: RequestInit) => Promise<Response>;
export type ManageResult = { kind: "updated"; content: string; editedAt: string } | { kind: "deleted" | "invalid" | "unauthorized" | "forbidden" | "missing" | "changed" | "uncertain" };
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function manageComment(fetchForSubject: AuthFetch, subject: string, id: string, method: "PATCH" | "DELETE", content = ""): Promise<ManageResult> {
  if (!uuid(subject) || !uuid(id) || (method === "PATCH" && (!/\S/u.test(content) || content.length > 1000))) return { kind: "invalid" };
  try {
    const init: RequestInit = method === "PATCH" ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) } : { method };
    const response = await fetchForSubject(subject, `/api/v1/comments/${id}`, init);
    if (response.status === 400) return { kind: "invalid" };
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 403) return { kind: "forbidden" };
    if (response.status === 404) return { kind: "missing" };
    if (response.status === 409) return { kind: "changed" };
    if (method === "DELETE" && response.status === 204) return { kind: "deleted" };
    if (method === "PATCH" && response.status === 200) {
      const value: unknown = await response.json();
      if (value && typeof value === "object" && "id" in value && value.id === id && "content" in value && typeof value.content === "string" && "isActive" in value && value.isActive === true && "editedAt" in value && typeof value.editedAt === "string" && !Number.isNaN(Date.parse(value.editedAt))) return { kind: "updated", content: value.content, editedAt: value.editedAt };
    }
  } catch { /* A mutation with an unknown outcome must not be repeated automatically. */ }
  return { kind: "uncertain" };
}
