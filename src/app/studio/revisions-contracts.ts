import { parseDraft, validDraftId, type Draft } from "./editor-contracts";

export type Revision = { id: string; title: string; createdAt: string; content?: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function revision(value: unknown, detail = false): Revision {
  if (!record(value) || typeof value.id !== "string" || !validDraftId(value.id) || typeof value.title !== "string" || value.title.length > 150 || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || (detail && (typeof value.content !== "string" || value.content.length > 50000))) throw new Error("Resposta inválida.");
  return { id: value.id, title: value.title, createdAt: value.createdAt, ...(detail ? { content: value.content as string } : {}) };
}
export function parseRevisions(value: unknown, page: number) {
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 10 || !record(value.meta) || value.meta.page !== page || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean") throw new Error("Resposta inválida.");
  const items = value.data.map(item => revision(item));
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error("Resposta inválida.");
  return { items, hasNext: value.meta.hasNextPage, hasPrevious: value.meta.hasPreviousPage };
}
export function parseRevision(value: unknown, expectedId: string) { const result = revision(value, true); if (result.id !== expectedId) throw new Error("Resposta inválida."); return result; }
export function parseRestored(value: unknown, owner: string, isAdmin: boolean, id: string): Draft { if (!record(value) || (value.isActive !== undefined && value.isActive !== true)) throw new Error("Resposta inválida."); const draft = parseDraft({ ...value, isActive: true }, owner, isAdmin); if (draft.id !== id || draft.reviewStatus === "PENDING") throw new Error("Resposta inválida."); return draft; }
