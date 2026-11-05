type AuthFetch = (subject: string, path: string, init: RequestInit) => Promise<Response>;
type Invalidate = (subject: string) => Promise<boolean>;

export async function deactivateAccount(fetchForSubject: AuthFetch, invalidate: Invalidate, subject: string): Promise<"deleted" | "unauthorized" | "forbidden" | "changed" | "uncertain"> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject)) return "uncertain";
  let result: "deleted" | "unauthorized" | "forbidden" | "changed" | "uncertain" = "uncertain";
  try {
    const response = await fetchForSubject(subject, `/api/v1/users/${subject}`, { method: "DELETE", cache: "no-store" });
    if (response.status === 204) result = "deleted";
    else if (response.status === 401) result = "unauthorized";
    else if (response.status === 403) result = "forbidden";
    else if (response.status === 409) result = "changed";
  } catch { /* The API may have completed the operation. */ }
  if (result === "deleted" || result === "uncertain") await invalidate(subject).catch(() => false);
  return result;
}
