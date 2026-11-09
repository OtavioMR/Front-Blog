export function validatePhoto(file: Pick<File, "size" | "type">): string | null {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return "Escolha uma imagem de até 5 MiB.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Escolha uma imagem JPEG, PNG ou WebP.";
  return null;
}

type FetchForSubject = (subject: string, path: string, init: RequestInit) => Promise<Response>;
export type PhotoUploadResult = { kind: "success"; profilePhoto: string } | { kind: "signed-out" | "account-changed" | "uncertain" } | { kind: "invalid"; message: string };

export async function uploadPhoto(subject: string, file: File, send: FetchForSubject): Promise<PhotoUploadResult> {
  const problem = validatePhoto(file);
  if (problem) return { kind: "invalid", message: problem };
  const data = new FormData();
  data.append("file", file);
  try {
    const response = await send(subject, `/api/v1/users/${subject}/profile-photo`, { method: "POST", body: data });
    if (response.status === 401) return { kind: "signed-out" };
    if (response.status === 409) return { kind: "account-changed" };
    if (response.status === 403) return { kind: "invalid", message: "Sua conta não pode atualizar esta foto." };
    if (response.status === 400 || response.status === 413 || response.status === 429) return { kind: "invalid", message: response.status === 413 ? "A imagem excede o limite de 5 MiB." : response.status === 429 ? "Aguarde antes de tentar novamente." : "Envie uma imagem JPEG, PNG ou WebP válida." };
    if (!response.ok) return { kind: "uncertain" };
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || result.id !== subject || !("profilePhoto" in result) || typeof result.profilePhoto !== "string" || !(/^\/uploads\/profile-photos\/[0-9a-f-]+\.webp$/i.test(result.profilePhoto) || /^https:\/\/[a-z0-9.-]+\/(?:profile-photos\/)?[0-9a-f-]+\.webp$/i.test(result.profilePhoto))) return { kind: "uncertain" };
    return { kind: "success", profilePhoto: result.profilePhoto };
  } catch { return { kind: "uncertain" }; }
}
