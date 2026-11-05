export function canConfirmRemoval(openedBy: string, currentSubject: string): boolean {
  return !!openedBy && openedBy === currentSubject;
}

type AuthFetch = (subject: string, path: string, init: RequestInit) => Promise<Response>;
export async function removeArticleRequest(fetchForSubject: AuthFetch, subject: string, id: string): Promise<"deleted" | "unauthorized" | "forbidden" | "missing" | "changed" | "uncertain"> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(subject) || !uuid.test(id)) return "uncertain";
  try {
    const response = await fetchForSubject(subject, `/api/v1/posts/${id}`, { method: "DELETE" });
    if (response.status === 204) return "deleted";
    if (response.status === 401) return "unauthorized";
    if (response.status === 403) return "forbidden";
    if (response.status === 404) return "missing";
    if (response.status === 409) return "changed";
  } catch { /* The mutation may have reached the API. */ }
  return "uncertain";
}
