export type SavedPage = {
  data: { id: string; title: string; excerpt: string; author: { name: string } }[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function parseSavedPage(value: unknown, requestedPage: number): SavedPage {
  if (!record(value) || !Array.isArray(value.data) || !record(value.meta)) throw new Error("Resposta inválida.");
  const meta = value.meta;
  if (meta.page !== requestedPage || meta.limit !== 10 || !Number.isSafeInteger(meta.total) || (meta.total as number) < 0 || !Number.isSafeInteger(meta.totalPages) || meta.totalPages !== Math.ceil((meta.total as number) / 10) || meta.hasPreviousPage !== (requestedPage > 1) || meta.hasNextPage !== (requestedPage < (meta.totalPages as number)) || value.data.length > 10 || value.data.length > Math.max(0, (meta.total as number) - (requestedPage - 1) * 10)) throw new Error("Paginação inválida.");
  const ids = new Set<string>();
  const data = value.data.map((item: unknown) => {
    if (!record(item) || !uuid(item.id) || ids.has(item.id) || typeof item.title !== "string" || typeof item.excerpt !== "string" || item.published !== true || item.isActive !== true || !record(item.author) || typeof item.author.name !== "string") throw new Error("Artigo inválido.");
    ids.add(item.id);
    return { id: item.id, title: item.title, excerpt: item.excerpt, author: { name: item.author.name } };
  });
  return { data, meta: meta as SavedPage["meta"] };
}

export async function loadSavedPage(page: number, fetcher: (path: string) => Promise<Response>) {
  const response = await fetcher(`/api/v1/posts/saved?page=${page}&limit=10`);
  if (response.status === 401) return { state: "signed-out" as const };
  if (response.status === 403) return { state: "forbidden" as const };
  if (!response.ok) throw new Error("Serviço indisponível.");
  return { state: "ready" as const, result: parseSavedPage(await response.json(), page) };
}

export async function loadOwnedSavedPage(page: number, getProfile: () => Promise<{ id: string } | null>, fetchForSubject: (subject: string, path: string) => Promise<Response>) {
  const profile = await getProfile();
  if (!profile) return { state: "signed-out" as const, owner: "" };
  const result = await loadSavedPage(page, path => fetchForSubject(profile.id, path));
  return { ...result, owner: result.state === "ready" ? profile.id : "" };
}
