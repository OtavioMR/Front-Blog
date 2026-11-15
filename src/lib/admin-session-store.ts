import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

let connection: pg.Pool | undefined;
function database(): pg.Pool {
  if (!connection) {
    const raw = process.env.ADMIN_SESSION_DATABASE_URL;
    if (!raw) throw new Error("administrative session PostgreSQL is not configured");
    const url = new URL(raw);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("invalid administrative database URL");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const tls = process.env.ADMIN_SESSION_DB_SSL === "true" || !local;
    for (const option of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(option);
    connection = new pg.Pool({ connectionString: url.toString(), max: 2, idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000, query_timeout: 5000, statement_timeout: 5000,
      application_name: "griforio-admin-bff",
      ssl: tls ? { rejectUnauthorized: true, ...(process.env.ADMIN_SESSION_DB_CA ? { ca: process.env.ADMIN_SESSION_DB_CA.replace(/\\n/g, "\n") } : {}) } : false });
    connection.on("error", () => undefined);
  }
  return connection;
}
export async function closeAdminSessionStore(): Promise<void> { const pool = connection; connection = undefined; await pool?.end(); }
function encryptionKey(): Buffer {
  const key = process.env.ADMIN_SESSION_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("administrative session encryption key is not configured");
  return Buffer.from(key, "hex");
}
function keyFor(id: string): string {
  const site = createHash("sha256").update(process.env.SITE_ORIGIN || "http://localhost:3000").digest("hex");
  return `griforio:editorial:${site}:${id}`;
}
function seal(key: string, value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(key));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export async function readStoredSession<T>(id: string): Promise<T | null> {
  const key = keyFor(id), secret = encryptionKey();
  const { rows } = await database().query<{ payload: string }>(
    "SELECT payload FROM admin_bff_sessions WHERE key=$1 AND expires_at > clock_timestamp()", [key]);
  if (!rows[0]) return null;
  try {
    const data = Buffer.from(rows[0].payload, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", secret, data.subarray(0, 12));
    decipher.setAAD(Buffer.from(key));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch { return null; }
}
export async function createStoredSession(id: string, value: unknown, expires: number): Promise<void> {
  const key = keyFor(id);
  await database().query("INSERT INTO admin_bff_sessions(key,payload,expires_at) VALUES($1,$2,$3)", [key, seal(key, value), new Date(expires)]);
}
export async function deleteStoredSession(id: string): Promise<void> {
  await database().query("DELETE FROM admin_bff_sessions WHERE key=$1", [keyFor(id)]);
}

// Statements commit independently: no transaction spans the callback's HTTP calls.
// Ownership and version fence paused instances; UPDATE cannot resurrect a deleted session.
export async function withStoredSession<T>(id: string, work: (save: (value: unknown, expires: number) => Promise<void>, remove: () => Promise<void>) => Promise<T>): Promise<T> {
  const key = keyFor(id), owner = randomBytes(32).toString("base64url"), db = database();
  const deadline = Date.now() + 25000;
  let version: string | undefined;
  while (true) {
    const claim = await db.query<{ version: string }>(`UPDATE admin_bff_sessions SET lease_owner=$2,
      lease_until=clock_timestamp() + interval '60 seconds', version=version+1
      WHERE key=$1 AND expires_at > clock_timestamp() AND (lease_until IS NULL OR lease_until <= clock_timestamp()) RETURNING version`, [key, owner]);
    if (claim.rows[0]) { version = claim.rows[0].version; break; }
    const active = await db.query("SELECT 1 FROM admin_bff_sessions WHERE key=$1 AND expires_at > clock_timestamp()", [key]);
    if (!active.rowCount) break;
    if (Date.now() >= deadline) throw new Error("administrative session is busy");
    await delay(40);
  }
  try {
    return await work(async (value, expires) => {
      const saved = await db.query<{ version: string }>(`UPDATE admin_bff_sessions SET payload=$4,expires_at=$5,version=version+1
        WHERE key=$1 AND lease_owner=$2 AND version=$3 AND lease_until > clock_timestamp() AND expires_at > clock_timestamp()
        RETURNING version`, [key, owner, version ?? -1, seal(key, value), new Date(expires)]);
      if (!saved.rows[0]) throw new Error("administrative session was revoked or lock expired");
      version = saved.rows[0].version;
    }, async () => {
      const removed = await db.query(`DELETE FROM admin_bff_sessions WHERE key=$1 AND lease_owner=$2
        AND version=$3 AND lease_until > clock_timestamp()`, [key, owner, version ?? -1]);
      if (!removed.rowCount) {
        const remaining = await db.query("SELECT 1 FROM admin_bff_sessions WHERE key=$1", [key]);
        if (remaining.rowCount) throw new Error("administrative session lock expired");
      }
    });
  } finally {
    await db.query("UPDATE admin_bff_sessions SET lease_owner=NULL,lease_until=NULL WHERE key=$1 AND lease_owner=$2", [key, owner]);
  }
}
