export type DeviceSession = { id: string; userAgent: string | null; createdAt: string; lastUsedAt: string; expiresAt: string; current: boolean };

export function parseSessions(value: unknown): DeviceSession[] {
  const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));
  if (!Array.isArray(value) || !value.every(item => item && typeof item === "object" && !Array.isArray(item)
    && typeof item.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
    && (item.userAgent === null || typeof item.userAgent === "string") && isDate(item.createdAt) && isDate(item.lastUsedAt) && isDate(item.expiresAt) && typeof item.current === "boolean")) throw new Error("Resposta de sessões inválida.");
  return value as DeviceSession[];
}
