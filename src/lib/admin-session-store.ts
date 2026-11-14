import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Redis } from "ioredis";

let connection: Redis | undefined;
function redis(): Redis {
  if (!process.env.REDIS_URL || !/^rediss?:\/\//.test(process.env.REDIS_URL)) throw new Error("administrative session Redis is not configured");
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000, commandTimeout: 3000 });
    // Never include connection errors (which may contain infrastructure details) in logs.
    connection.on("error", ignoreError);
  }
  return connection;
}
const ignoreError = () => undefined;
export function closeAdminSessionStore(): void { connection?.disconnect(); connection = undefined; }
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
  const value = await redis().get(key);
  if (!value) return null;
  try {
    const data = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", secret, data.subarray(0, 12));
    decipher.setAAD(Buffer.from(key));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch { return null; }
}
export async function createStoredSession(id: string, value: unknown, expires: number): Promise<void> {
  const key = keyFor(id);
  const result = await redis().set(key, seal(key, value), "PX", Math.max(1, expires - Date.now()), "NX");
  if (result !== "OK") throw new Error("administrative session was not persisted");
}
export async function deleteStoredSession(id: string): Promise<void> { await redis().del(keyFor(id)); }

// The lock serializes rotation across routes, processes and Vercel instances.
// Saves check both lock ownership and existence: expired leases and concurrent
// logout can never overwrite a newer generation or resurrect a deleted session.
export async function withStoredSession<T>(id: string, work: (save: (value: unknown, expires: number) => Promise<void>, remove: () => Promise<void>) => Promise<T>): Promise<T> {
  const key = keyFor(id), lock = `${key}:lock`, owner = randomBytes(32).toString("base64url");
  const client = redis(), deadline = Date.now() + 25000;
  while (await client.set(lock, owner, "PX", 60000, "NX") !== "OK") {
    if (Date.now() >= deadline) throw new Error("administrative session is busy");
    await delay(40);
  }
  try {
    return await work(async (value, expires) => {
      const result = await client.eval("if redis.call('GET', KEYS[2]) == ARGV[1] and redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3]) end return nil", 2, key, lock, owner, seal(key, value), Math.max(1, expires - Date.now()));
      if (result !== "OK") throw new Error("administrative session was revoked or lock expired");
    }, async () => {
      const result = await client.eval("if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end return 0", 2, key, lock, owner);
      if (result !== 1) throw new Error("administrative session lock expired");
    });
  } finally {
    await client.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", 1, lock, owner);
  }
}
