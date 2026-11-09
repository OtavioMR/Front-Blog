export type Author = {
  id: string;
  name: string;
  profilePhoto: string | null;
  bio: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  publicationCount: number;
};

export type AuthorArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string | null;
  publishedAt: string | null;
  readingTimeMinutes: number;
  author?: { id: string; name: string };
  categories?: { id?: string; name: string; slug?: string }[];
};

export type AuthorArticlesPage = {
  data: AuthorArticle[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export async function getAuthor(id: string): Promise<Author | null> {
  if (!uuid.test(id)) return null;
  const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1/authors/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Serviço de autores indisponível.");
  const value: unknown = await response.json();
  if (!record(value)) throw new Error("Resposta inválida do serviço de autores.");
  const result = value as Record<string, unknown>;
  if (
    typeof result.id !== "string" ||
    !uuid.test(result.id) ||
    result.id.toLowerCase() !== id.toLowerCase() ||
    typeof result.name !== "string" ||
    !nullableString(result.profilePhoto) ||
    !nullableString(result.bio) ||
    !nullableString(result.websiteUrl) ||
    !nullableString(result.socialUrl) ||
    !Number.isSafeInteger(result.publicationCount) ||
    (result.publicationCount as number) < 0
  ) {
    throw new Error("Resposta inválida do serviço de autores.");
  }
  return result as Author;
}

function isAuthorArticle(value: unknown): value is AuthorArticle {
  if (!record(value)) return false;
  if (typeof value.id !== "string" || !uuid.test(value.id)) return false;
  if (typeof value.slug !== "string" || !slugRegex.test(value.slug)) return false;
  if (typeof value.title !== "string" || typeof value.excerpt !== "string") return false;
  if (value.published !== true || value.isActive !== true) return false;
  if (!(value.coverImage === null || value.coverImage === undefined || typeof value.coverImage === "string")) return false;
  if (!(value.publishedAt === null || typeof value.publishedAt === "string")) return false;
  if (typeof value.readingTimeMinutes !== "number" || !Number.isFinite(value.readingTimeMinutes) || value.readingTimeMinutes < 1) return false;
  if (value.author !== undefined && (!record(value.author) || typeof value.author.name !== "string")) return false;
  if (value.categories !== undefined && (!Array.isArray(value.categories) || !value.categories.every((c) => record(c) && typeof c.name === "string"))) return false;
  return true;
}

function parseArticlesPage(value: unknown): AuthorArticlesPage {
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(isAuthorArticle)) {
    throw new Error("Resposta inválida do serviço de artigos.");
  }
  if (
    !record(value.meta) ||
    !Number.isSafeInteger(value.meta.page) ||
    !Number.isSafeInteger(value.meta.totalPages) ||
    typeof value.meta.hasNextPage !== "boolean" ||
    typeof value.meta.hasPreviousPage !== "boolean"
  ) {
    throw new Error("Metadados inválidos do serviço de artigos.");
  }
  return {
    data: value.data,
    meta: {
      page: value.meta.page as number,
      limit: typeof value.meta.limit === "number" ? value.meta.limit : 6,
      total: typeof value.meta.total === "number" ? value.meta.total : value.data.length,
      totalPages: value.meta.totalPages as number,
      hasNextPage: value.meta.hasNextPage as boolean,
      hasPreviousPage: value.meta.hasPreviousPage as boolean,
    },
  };
}

export async function getAuthorArticles(
  authorId: string,
  authorName: string,
  page: number = 1,
  limit: number = 6,
): Promise<AuthorArticlesPage> {
  if (!uuid.test(authorId)) {
    return {
      data: [],
      meta: { page: 1, limit, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    };
  }
  const origin = process.env.API_ORIGIN || "http://localhost:3001";
  const primaryUrl = `${origin}/api/v1/posts?authorId=${encodeURIComponent(authorId)}&page=${page}&limit=${limit}`;
  const response = await fetch(primaryUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (response.ok) {
    const json: unknown = await response.json();
    return parseArticlesPage(json);
  }

  // Graceful fallback for environments where authorId query param is not yet present
  if (response.status === 400 && authorName.trim()) {
    const fallbackUrl = `${origin}/api/v1/posts?author=${encodeURIComponent(authorName.trim())}&page=${page}&limit=${limit}`;
    const fallbackResponse = await fetch(fallbackUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!fallbackResponse.ok) throw new Error("Serviço de artigos indisponível.");
    const json: unknown = await fallbackResponse.json();
    const parsed = parseArticlesPage(json);
    const filtered = parsed.data.filter((item) => !item.author?.id || item.author.id.toLowerCase() === authorId.toLowerCase());
    return {
      ...parsed,
      data: filtered,
    };
  }

  throw new Error("Serviço de artigos indisponível.");
}

export function pageNumber(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : 1;
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function photoPath(value: string | null): string | null {
  if (!value) return null;
  if (/^\/uploads\/profile-photos\/[0-9a-f-]+\.(webp|png|jpe?g)$/i.test(value)) return value;
  if (/^https:\/\/[a-z0-9.-]+\/(?:profile-photos\/)?[0-9a-f-]+\.(webp|png|jpe?g)$/i.test(value)) return value;
  return null;
}

export function coverPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\/uploads\/post-covers\/[a-z0-9-]+\.(webp|png|jpe?g)$/i.test(value)) return value;
  if (/^https:\/\/[a-z0-9.-]+\/(?:post-covers\/)?[a-z0-9-]+\.(webp|png|jpe?g)$/i.test(value)) return value;
  return null;
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return null;
  }
}
