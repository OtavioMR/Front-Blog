import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("valida sessões antes de apresentar os dispositivos", async () => {
  const source = await readFile(new URL("../src/app/conta/sessoes/data.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseSessions } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const item = { id: "4c781e0d-b963-493c-b2df-0a8fa66c0615", userAgent: null, createdAt: "2026-01-01T00:00:00Z", lastUsedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-02-01T00:00:00Z", current: true };
  assert.deepEqual(parseSessions([item]), [item]);
  assert.deepEqual(parseSessions([]), []);
  assert.throws(() => parseSessions([{ ...item, current: "true" }]));
  assert.throws(() => parseSessions([{ ...item, id: "../outra" }]));
  assert.throws(() => parseSessions([{ ...item, expiresAt: "inválida" }]));
});
