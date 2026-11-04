import { cache } from "react";

export type PublicPost = {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: string | null;
  updatedAt?: string;
  readingTimeMinutes: number;
  author?: { name: string; id?: string };
  categories: { name: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePost(value: unknown): PublicPost {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) || typeof value.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) ||
      typeof value.title !== "string" || typeof value.content !== "string" || typeof value.excerpt !== "string" ||
      value.published !== true || value.isActive !== true ||
      !(value.coverImage === null || typeof value.coverImage === "string") ||
      !(value.publishedAt === null || (typeof value.publishedAt === "string" && !Number.isNaN(Date.parse(value.publishedAt)))) ||
      !(value.updatedAt === undefined || (typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt)))) ||
      typeof value.readingTimeMinutes !== "number" || !Number.isFinite(value.readingTimeMinutes) || value.readingTimeMinutes < 1 ||
      !Array.isArray(value.categories) || !value.categories.every((category: unknown) => isRecord(category) && typeof category.name === "string") ||
      !(value.author === undefined || (isRecord(value.author) && typeof value.author.name === "string" && (value.author.id === undefined || typeof value.author.id === "string")))) {
    throw new Error("Resposta inválida do serviço de artigos.");
  }
  return value as PublicPost;
}

// Never forward request cookies or authorization: this endpoint also serves drafts to their owners.
export const getPublicPost = cache(async (slug: string): Promise<PublicPost | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 150) return null;
  const origin = process.env.API_ORIGIN ?? "http://localhost:3001";
  const response = await fetch(`${origin}/api/v1/posts/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Serviço de artigos indisponível.");
  return parsePost(await response.json());
});

export function publicCoverPath(path: string | null): string | null {
  return path && /^\/uploads\/post-covers\/[a-z0-9-]+\.webp$/i.test(path) ? path : null;
}

export function publicAuthorPath(id?: string): string | null {
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? `/autores/${id}` : null;
}
