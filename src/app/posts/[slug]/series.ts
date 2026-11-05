type SeriesPost = { id: string; slug: string; title: string; position: number };
export type PublicSeries = { id: string; title: string; description: string; posts: SeriesPost[] };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export async function getPublicSeries(postId: string, slug: string): Promise<PublicSeries | null> {
  if (!uuid(postId)) return null;
  try {
    const origin = process.env.API_ORIGIN || "http://localhost:3001";
    const response = await fetch(`${origin}/api/v1/posts/${postId}/series`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!record(value) || !uuid(value.id) || typeof value.title !== "string" || !value.title.trim() || value.title.length > 200 || typeof value.description !== "string" || value.description.length > 2000 || !Array.isArray(value.posts) || value.posts.length === 0 || value.posts.length > 100) return null;
    const posts: SeriesPost[] = [];
    for (const item of value.posts) {
      if (!record(item) || !uuid(item.id) || typeof item.slug !== "string" || item.slug.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 300 || !Number.isSafeInteger(item.position) || (item.position as number) < 1 || item.published === false || item.isActive === false) return null;
      if (posts.some(post => post.id === item.id || post.slug === item.slug || post.position >= (item.position as number))) return null;
      posts.push({ id: item.id, slug: item.slug, title: item.title, position: item.position as number });
    }
    if (!posts.some(post => post.id === postId && post.slug === slug)) return null;
    return { id: value.id, title: value.title, description: value.description, posts };
  } catch { return null; }
}
