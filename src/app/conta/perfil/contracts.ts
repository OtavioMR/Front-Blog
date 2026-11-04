export type ProfileFields = { name: string; bio: string; websiteUrl: string; socialUrl: string };

export function parseProfile(value: unknown): ProfileFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Perfil inválido.");
  const profile = value as Record<string, unknown>;
  if (typeof profile.name !== "string" || !(profile.bio === null || typeof profile.bio === "string") || !(profile.websiteUrl === null || typeof profile.websiteUrl === "string") || !(profile.socialUrl === null || typeof profile.socialUrl === "string")) throw new Error("Perfil inválido.");
  return { name: profile.name, bio: profile.bio ?? "", websiteUrl: profile.websiteUrl ?? "", socialUrl: profile.socialUrl ?? "" };
}

export function profilePayload(fields: ProfileFields) {
  const name = fields.name.trim();
  if (name.length < 2 || name.length > 100) throw new Error("O nome deve ter entre 2 e 100 caracteres.");
  if (fields.bio.length > 500) throw new Error("A biografia deve ter até 500 caracteres.");
  const link = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 500) throw new Error("Os links devem ter até 500 caracteres.");
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname.includes(".")) throw new Error();
    } catch { throw new Error("Informe links públicos com http:// ou https://."); }
    return trimmed;
  };
  return { name, bio: fields.bio.trim() || null, websiteUrl: link(fields.websiteUrl), socialUrl: link(fields.socialUrl) };
}
