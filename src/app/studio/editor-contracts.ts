const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Draft = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  published: boolean;
  isActive: boolean;
  reviewStatus: string;
  scheduledAt: string | null;
  slug?: string | null;
  coverImage?: string | null;
  categories?: { id: string; name?: string; slug?: string }[];
  tags?: { id?: string; name: string; slug?: string }[];
};

export function parseDraft(value: unknown, owner: string, isAdmin = false): Draft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta inválida.");
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    !uuid.test(item.id) ||
    (!isAdmin && item.authorId !== owner) ||
    typeof item.title !== "string" ||
    typeof item.content !== "string" ||
    typeof item.published !== "boolean" ||
    item.isActive !== true ||
    !["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(String(item.reviewStatus)) ||
    (item.scheduledAt !== null &&
      (typeof item.scheduledAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(item.scheduledAt) ||
        !Number.isFinite(Date.parse(item.scheduledAt))))
  ) {
    throw new Error("Resposta inválida.");
  }
  return item as unknown as Draft;
}

export function validDraftId(id: string) { return uuid.test(id); }
export function isPendingResponse(value: unknown) { return !!value && typeof value === "object" && "status" in value && value.status === "PENDING"; }
