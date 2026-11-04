type Category = { id: string; slug: string; name: string; description: string | null };
type Article = { id: string; slug: string; title: string; excerpt: string; readingTimeMinutes: number; author?: { name: string } };
type Meta = { page: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
type Page<T> = { data: T[]; meta: Meta };

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const slug = (value: unknown): value is string => typeof value === "string" && value.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const category = (value: unknown): value is Category => record(value) && typeof value.id === "string" && slug(value.slug) && typeof value.name === "string" && (value.description === null || typeof value.description === "string") && value.isActive === true;
const article = (value: unknown): value is Article => record(value) && typeof value.id === "string" && slug(value.slug) && typeof value.title === "string" && typeof value.excerpt === "string" && value.published === true && value.isActive === true && typeof value.readingTimeMinutes === "number" && Number.isFinite(value.readingTimeMinutes) && value.readingTimeMinutes >= 1 && (value.author === undefined || (record(value.author) && typeof value.author.name === "string"));

function parsePage<T>(value: unknown, parseItem: (item: unknown) => item is T): Page<T> {
  if (!record(value) || !Array.isArray(value.data) || !value.data.every(parseItem) || !record(value.meta) || !Number.isSafeInteger(value.meta.page) || !Number.isSafeInteger(value.meta.totalPages) || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean") throw new Error("Resposta inválida do serviço.");
  return value as Page<T>;
}

async function request(path: string): Promise<unknown | null> {
  const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1${path}`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Serviço indisponível.");
  return response.json();
}

export function pageNumber(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : 1;
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}

export async function getCategories(page: number): Promise<Page<Category>> {
  return parsePage(await request(`/categories?page=${page}&limit=12`), category);
}

export async function getCategory(value: string): Promise<Category | null> {
  if (!slug(value) || value.length > 120) return null;
  const result = await request(`/categories/${encodeURIComponent(value)}`);
  if (result === null) return null;
  if (!category(result)) throw new Error("Resposta inválida do serviço.");
  return result;
}

export async function getCategoryArticles(value: string, page: number): Promise<Page<Article> | null> {
  const result = await request(`/categories/${encodeURIComponent(value)}/posts?page=${page}&limit=6`);
  return result === null ? null : parsePage(result, article);
}
