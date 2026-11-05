const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Feed = { data: { id: string; slug: string; title: string; excerpt: string; publishedAt: string | null; author: { id: string; name: string } }[]; meta: { page: number; hasNextPage: boolean; hasPreviousPage: boolean } };
export function parseFeed(value: unknown, page: number): Feed {
  if (!record(value) || !record(value.meta) || value.meta.page !== page || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean" || !Array.isArray(value.data) || value.data.length > 10 || !value.data.every((item: unknown) => record(item) && typeof item.id === "string" && uuid.test(item.id) && typeof item.slug === "string" && !!item.slug && typeof item.title === "string" && typeof item.excerpt === "string" && (item.publishedAt === null || (typeof item.publishedAt === "string" && Number.isFinite(Date.parse(item.publishedAt)))) && record(item.author) && typeof item.author.id === "string" && uuid.test(item.author.id) && typeof item.author.name === "string")) throw new Error("Feed inválido.");
  return value as Feed;
}
