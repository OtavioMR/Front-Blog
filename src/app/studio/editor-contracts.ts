const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Draft = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  excerpt?: string;
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
    (item.excerpt !== undefined && (typeof item.excerpt !== "string" || item.excerpt.length > 500)) ||
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

export function reviewEligibility(role: string, requesterId: string, authorId: string, firstPostApproved: boolean | undefined): "eligible" | "ineligible" | "unknown" {
  if (role !== "AUTHOR" || !requesterId || requesterId !== authorId) return "ineligible";
  if (firstPostApproved === undefined) return "unknown";
  return firstPostApproved ? "ineligible" : "eligible";
}

export function publicationEligibility(role: string, requesterId: string, authorId: string, firstPostApproved: boolean | undefined): "eligible" | "ineligible" | "unknown" {
  if (!["AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(role) || !requesterId || requesterId !== authorId) return "ineligible";
  if (firstPostApproved === undefined) return "unknown";
  return firstPostApproved ? "eligible" : "ineligible";
}

// PATCH responses omit isActive, while the endpoint only updates active posts.
// Reject an explicit inactive value and retain strict validation for every other field.
export function parseUpdatedDraft(value: unknown, owner: string, isAdmin = false): Draft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta inválida.");
  const item = value as Record<string, unknown>;
  return parseDraft(item.isActive === undefined ? { ...item, isActive: true } : item, owner, isAdmin);
}

export function parsePublicationResponse(value: unknown, owner: string, id: string, publish: boolean): Draft {
  const draft = parseUpdatedDraft(value, owner);
  if (draft.id !== id || draft.published !== publish || draft.reviewStatus === "PENDING" || (publish && draft.scheduledAt !== null)) throw new Error("Resposta inv\u00e1lida.");
  return draft;
}

export function scheduleToIso(local: string, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(local);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now) return null;
  const part = (value: number) => String(value).padStart(2, "0");
  const roundtrip = `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
  return roundtrip === local ? date.toISOString() : null;
}

export function parseScheduleResponse(value: unknown, owner: string, id: string, scheduled: string | null): Draft {
  const draft = parseUpdatedDraft(value, owner);
  if (draft.id !== id || draft.published || draft.reviewStatus === "PENDING" ||
      (scheduled === null ? draft.scheduledAt !== null : draft.scheduledAt === null || Date.parse(draft.scheduledAt) !== Date.parse(scheduled))) throw new Error("Invalid schedule response.");
  return draft;
}
