import { pageNumber } from "../categorias/data";

type Tag = { id: string; slug: string; name: string };
type Article = { id: string; slug: string; title: string; excerpt: string };
type Page<T> = { data: T[]; meta: { page: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const slug = (v: unknown): v is string => typeof v === "string" && v.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const tag = (v: unknown): v is Tag => record(v) && typeof v.id === "string" && slug(v.slug) && typeof v.name === "string";
const article = (v: unknown): v is Article => record(v) && typeof v.id === "string" && typeof v.slug === "string" && v.slug.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug) && typeof v.title === "string" && typeof v.excerpt === "string" && v.published === true && v.isActive === true;
async function request(path: string): Promise<unknown | null> {
  const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Serviço indisponível.");
  return response.json();
}
function parsePage<T>(v: unknown, valid: (item: unknown) => item is T): Page<T> {
  if (!record(v) || !Array.isArray(v.data) || !v.data.every(valid) || !record(v.meta) || !Number.isSafeInteger(v.meta.page) || !Number.isSafeInteger(v.meta.totalPages) || typeof v.meta.hasNextPage !== "boolean" || typeof v.meta.hasPreviousPage !== "boolean") throw new Error("Resposta inválida do serviço.");
  return v as Page<T>;
}
export { pageNumber };
export async function getTags(page: number) { return parsePage(await request(`/tags?page=${page}&limit=12`), tag); }
export async function getTag(value: string): Promise<Tag | null> {
  if (!slug(value)) return null;
  const result = await request(`/tags/${encodeURIComponent(value)}`);
  if (result === null) return null;
  if (!tag(result)) throw new Error("Resposta inválida do serviço.");
  return result;
}
export async function getTagArticles(value: string, page: number) {
  return parsePage(await request(`/posts?tagSlug=${encodeURIComponent(value)}&page=${page}&limit=6`), article);
}
