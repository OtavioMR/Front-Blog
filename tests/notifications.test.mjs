import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
test("notificacoes validam tipo, pagina, identidade e contagem", async () => {
  const source = await readFile(new URL("../src/app/conta/notificacoes/data.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseNotifications } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const item = { id, type: "follow", postId: null, commentId: null, readAt: null, createdAt: "2026-01-01T00:00:00Z", actor: { id, name: "Leitor" } };
  const result = { data: [item], unread: 1, meta: { page: 1, hasNextPage: false, hasPreviousPage: false } };
  assert.equal(parseNotifications(result, 1).unread, 1);
  for (const type of ["post_approved", "post_rejected", "post_hidden", "post_restored", "comment_hidden", "comment_restored", "role_changed", "sessions_revoked", "account_suspended", "account_restored", "report_assigned"]) {
    assert.equal(parseNotifications({ ...result, data: [{ ...item, type, postId: id }] }, 1).data[0].type, type);
  }
  assert.throws(() => parseNotifications(result, 2));
  assert.throws(() => parseNotifications({ ...result, unread: -1 }, 1));
  assert.throws(() => parseNotifications({ ...result, data: [{ ...item, type: "unknown" }] }, 1));
  assert.throws(() => parseNotifications({ ...result, data: [{ ...item, actor: { id: "invalid", name: "x" } }] }, 1));
});
