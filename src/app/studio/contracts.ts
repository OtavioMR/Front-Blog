export type Rules = { version: string; rules: string[] };
export type OwnArticle = { id: string; title: string; published: boolean; reviewStatus: string; slug: string; scheduledAt?: string | null };
export type OwnArticles = { data: OwnArticle[]; meta: { page: number; hasNextPage: boolean; hasPreviousPage: boolean } };

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export function parseRules(value: unknown): Rules {
  if (!record(value) || typeof value.version !== "string" || !value.version || !Array.isArray(value.rules) || !value.rules.every((rule: unknown) => typeof rule === "string")) throw new Error("Regras indisponíveis.");
  return value as Rules;
}

export function parseOwnArticles(value: unknown): OwnArticles {
  if (!record(value) || !Array.isArray(value.data) || !value.data.every((item: unknown) => record(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.slug === "string" && typeof item.published === "boolean" && typeof item.reviewStatus === "string" && (item.scheduledAt === undefined || item.scheduledAt === null || (typeof item.scheduledAt === "string" && Number.isFinite(Date.parse(item.scheduledAt))))) || !record(value.meta) || !Number.isInteger(value.meta.page) || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean") throw new Error("Lista indisponível.");
  return value as OwnArticles;
}

export function acceptedRules(value: unknown, version: string): boolean {
  return record(value) && value.role === "AUTHOR" && value.rulesVersion === version;
}
