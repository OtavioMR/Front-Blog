type RelatedPost = { slug: string; title: string; excerpt: string; readingTimeMinutes: number; author?: { name: string } };

function isRelatedPost(value: unknown): value is RelatedPost {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const post = value as Record<string, unknown>;
  const author = post.author;
  return typeof post.slug === "string" && post.slug.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
    && typeof post.title === "string" && typeof post.excerpt === "string" && post.published === true && post.isActive === true
    && typeof post.readingTimeMinutes === "number" && Number.isFinite(post.readingTimeMinutes) && post.readingTimeMinutes >= 1
    && (author === undefined || (typeof author === "object" && author !== null && !Array.isArray(author) && "name" in author && typeof author.name === "string"));
}

// Anonymous request: no visitor credentials are forwarded to the API.
export async function getRelatedPosts(slug: string): Promise<RelatedPost[] | null> {
  try {
    const origin = process.env.API_ORIGIN || "http://localhost:3001";
    const response = await fetch(`${origin}/api/v1/posts/${encodeURIComponent(slug)}/related`, {
      cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) && data.length <= 4 && data.every(isRelatedPost) ? data : null;
  } catch { return null; }
}
