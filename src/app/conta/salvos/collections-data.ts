export type Collection = { id: string; name: string; createdAt: string };
export type CollectionPost = { id: string; slug: string; title: string; excerpt: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function parseCollection(v: unknown): Collection {
  if (!record(v) || !uuid(v.id) || typeof v.name !== "string" || !v.name.trim() || v.name.length > 100 || typeof v.createdAt !== "string" || !Number.isFinite(Date.parse(v.createdAt))) throw new Error("Resposta inválida.");
  return { id: v.id, name: v.name, createdAt: v.createdAt };
}
export function parseCollections(v: unknown): Collection[] {
  if (!Array.isArray(v) || v.length > 10000) throw new Error("Resposta inválida.");
  const items = v.map(parseCollection); if (new Set(items.map(i => i.id)).size !== items.length) throw new Error("Resposta inválida."); return items;
}
export function parseCollectionPosts(v: unknown, page: number) {
  if (!record(v) || !Array.isArray(v.data) || v.data.length > 10 || !record(v.meta) || v.meta.page !== page || typeof v.meta.hasPreviousPage !== "boolean" || typeof v.meta.hasNextPage !== "boolean") throw new Error("Resposta inválida.");
  const items: CollectionPost[] = v.data.map((p: unknown) => { if (!record(p) || !uuid(p.id) || typeof p.slug !== "string" || p.slug.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || typeof p.title !== "string" || typeof p.excerpt !== "string" || p.published === false || p.isActive === false) throw new Error("Resposta inválida."); return { id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt }; });
  if (new Set(items.map(p => p.id)).size !== items.length) throw new Error("Resposta inválida.");
  return { items, previous: v.meta.hasPreviousPage, next: v.meta.hasNextPage };
}
