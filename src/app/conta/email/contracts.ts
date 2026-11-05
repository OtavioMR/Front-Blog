type AuthFetch = (subject: string, path: string, init: RequestInit) => Promise<Response>;

export function emailPayload(email: string, currentPassword: string, currentEmail: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) throw new Error("Informe um e-mail válido com até 255 caracteres.");
  if (normalized === currentEmail.trim().toLowerCase()) throw new Error("Informe um endereço diferente do e-mail atual.");
  if (!currentPassword || new TextEncoder().encode(currentPassword).length > 72) throw new Error("Informe a senha atual com até 72 bytes.");
  return { email: normalized, currentPassword };
}

export async function requestEmailChange(fetchForSubject: AuthFetch, subject: string, payload: { email: string; currentPassword: string }): Promise<"requested" | "invalid" | "unauthorized" | "forbidden" | "conflict" | "uncertain"> {
  try {
    const response = await fetchForSubject(subject, `/api/v1/users/${encodeURIComponent(subject)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    if (response.status === 400) return "invalid";
    if (response.status === 401) return "unauthorized";
    if (response.status === 403) return "forbidden";
    if (response.status === 409) return "conflict";
    if (response.status === 200) {
      const value: unknown = await response.json();
      if (value && typeof value === "object" && "id" in value && value.id === subject) return "requested";
    }
  } catch { /* The request may already have reached the server. */ }
  return "uncertain";
}
