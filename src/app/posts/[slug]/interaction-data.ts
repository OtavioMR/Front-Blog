export type Interaction = { liked: boolean; saved: boolean; likes: number };
export type InteractionKind = "like" | "save";

export function parseInteraction(value: unknown): Interaction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta inválida.");
  const item = value as Record<string, unknown>;
  if (typeof item.liked !== "boolean" || typeof item.saved !== "boolean" || typeof item.likes !== "number" || !Number.isSafeInteger(item.likes) || item.likes < 0) throw new Error("Resposta inválida.");
  return { liked: item.liked, saved: item.saved, likes: item.likes };
}

export function interactionRequest(postId: string, kind: InteractionKind, state: Interaction) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) throw new Error("Artigo inválido.");
  const enabled = kind === "like" ? state.liked : state.saved;
  return { path: `/api/v1/posts/${postId}/${kind}`, method: enabled ? "DELETE" : "PUT" };
}

export function changeInteraction(fetcher: (subject: string, path: string, init: RequestInit) => Promise<Response>, subject: string, postId: string, kind: InteractionKind, state: Interaction): Promise<Response> {
  const request = interactionRequest(postId, kind, state);
  return fetcher(subject, request.path, { method: request.method, cache: "no-store" });
}
