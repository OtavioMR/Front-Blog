type Author = { id: string; name: string; profilePhoto: string | null; bio: string | null; websiteUrl: string | null; socialUrl: string | null; publicationCount: number };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

export async function getAuthor(id: string): Promise<Author | null> {
  if (!uuid.test(id)) return null;
  const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1/authors/${encodeURIComponent(id)}`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Serviço de autores indisponível.");
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Resposta inválida do serviço de autores.");
  const result = value as Record<string, unknown>;
  if (typeof result.id !== "string" || !uuid.test(result.id) || result.id.toLowerCase() !== id.toLowerCase() || typeof result.name !== "string" || !nullableString(result.profilePhoto) || !nullableString(result.bio) || !nullableString(result.websiteUrl) || !nullableString(result.socialUrl) || !Number.isSafeInteger(result.publicationCount) || (result.publicationCount as number) < 0) throw new Error("Resposta inválida do serviço de autores.");
  return result as Author;
}

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function photoPath(value: string | null): string | null {
  return value && /^\/uploads\/profile-photos\/[0-9a-f-]+\.webp$/i.test(value) ? value : null;
}
