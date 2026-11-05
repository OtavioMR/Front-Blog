const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export type Series = { id: string; authorId: string; title: string; description: string; createdAt: string; updatedAt: string };
export type Item = { id: string; title: string; slug: string; published: boolean; isActive: boolean; position: number };
export type Detail = Series & { posts: Item[] };

export function parseSeries(value: unknown, owner: string): Series {
  if (!record(value) || typeof value.id !== "string" || !uuid.test(value.id) || value.authorId !== owner || typeof value.title !== "string" || typeof value.description !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error("Série inválida.");
  return value as Series;
}
export function parseSeriesList(value: unknown, owner: string): Series[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Lista inválida.");
  return value.map(item => parseSeries(item, owner));
}
export function parseDetail(value: unknown, owner: string, id: string): Detail {
  const series = parseSeries(value, owner);
  if (series.id !== id || !record(value) || !Array.isArray(value.posts) || value.posts.length > 100 || !value.posts.every((item: unknown) => record(item) && typeof item.id === "string" && uuid.test(item.id) && typeof item.title === "string" && typeof item.slug === "string" && typeof item.published === "boolean" && typeof item.isActive === "boolean" && Number.isInteger(item.position))) throw new Error("Itens inválidos.");
  const posts = value.posts as Item[];
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw new Error("Itens duplicados.");
  return { ...series, posts };
}
export function confirmedItems(value: unknown, ids: string[]): boolean {
  return record(value) && Array.isArray(value.postIds) && value.postIds.length === ids.length && value.postIds.every((id: unknown, i: number) => id === ids[i]);
}
