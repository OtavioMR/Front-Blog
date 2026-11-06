export type RelatedPost = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  readingTimeMinutes: number;
  author?: { name: string; id?: string };
};

export type RecommendationTarget = {
  slug: string;
  id?: string;
  authorId?: string;
};

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_RECOMMENDATIONS = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRelatedPost(value: unknown): RelatedPost | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.slug !== "string" ||
    value.slug.length > 150 ||
    !SLUG_REGEX.test(value.slug) ||
    typeof value.title !== "string" ||
    typeof value.excerpt !== "string" ||
    value.published !== true ||
    value.isActive !== true
  ) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : undefined;
  const readingTime =
    typeof value.readingTimeMinutes === "number" &&
    Number.isFinite(value.readingTimeMinutes) &&
    value.readingTimeMinutes >= 1
      ? Math.round(value.readingTimeMinutes)
      : 1;

  let author: { name: string; id?: string } | undefined;
  if (isRecord(value.author)) {
    if (typeof value.author.name === "string") {
      author = {
        name: value.author.name,
        ...(typeof value.author.id === "string" ? { id: value.author.id } : {}),
      };
    }
  }

  return {
    id,
    slug: value.slug,
    title: value.title,
    excerpt: value.excerpt,
    readingTimeMinutes: readingTime,
    author,
  };
}

// Anonymous requests: no visitor credentials are forwarded to the API.
export async function getRelatedPosts(
  target: string | RecommendationTarget
): Promise<RelatedPost[] | null> {
  const targetSlug = typeof target === "string" ? target : target.slug;
  const targetAuthorId = typeof target === "object" ? target.authorId : undefined;

  if (!targetSlug || typeof targetSlug !== "string" || !SLUG_REGEX.test(targetSlug) || targetSlug.length > 150) {
    return null;
  }

  const origin = process.env.API_ORIGIN || "http://localhost:3001";
  const results: RelatedPost[] = [];
  const seenSlugs = new Set<string>([targetSlug]);

  function addCandidate(raw: unknown): void {
    if (results.length >= MAX_RECOMMENDATIONS) return;
    const item = toRelatedPost(raw);
    if (!item) return;
    if (seenSlugs.has(item.slug)) return;

    seenSlugs.add(item.slug);
    results.push(item);
  }

  // 1. Artigos relacionados (mesmas tags/categorias ativas via endpoint nativo)
  try {
    const response = await fetch(
      `${origin}/api/v1/posts/${encodeURIComponent(targetSlug)}/related`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (response.ok) {
      const data: unknown = await response.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          addCandidate(item);
          if (results.length >= MAX_RECOMMENDATIONS) break;
        }
      }
    }
  } catch {
    // Falha pontual no tier 1 não deve interromper os fallbacks
  }

  // 2. Artigos do mesmo autor (quando houver poucos artigos relacionados)
  if (results.length < MAX_RECOMMENDATIONS && targetAuthorId) {
    try {
      const response = await fetch(
        `${origin}/api/v1/posts?authorId=${encodeURIComponent(targetAuthorId)}&limit=10`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (response.ok) {
        const body: unknown = await response.json();
        if (isRecord(body) && Array.isArray(body.data)) {
          for (const item of body.data) {
            addCandidate(item);
            if (results.length >= MAX_RECOMMENDATIONS) break;
          }
        }
      }
    } catch {
      // Falha no tier 2 não deve interromper o tier 3
    }
  }

  // 3. Outros artigos publicados no blog (quando ainda não houver recomendações suficientes)
  if (results.length < MAX_RECOMMENDATIONS) {
    try {
      const response = await fetch(`${origin}/api/v1/posts?limit=10`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (isRecord(body) && Array.isArray(body.data)) {
          for (const item of body.data) {
            addCandidate(item);
            if (results.length >= MAX_RECOMMENDATIONS) break;
          }
        }
      }
    } catch {
      // Falha no tier 3
    }
  }

  // 4. Fallback inteligente: retorna os artigos disponíveis (1 a 4) ou lista vazia caso não haja nenhum outro artigo elegível
  return results;
}
