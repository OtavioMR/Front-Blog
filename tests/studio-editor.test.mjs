import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("editor aceita somente rascunhos da conta e confirmação PENDING válida", async () => {
  const source = await readFile(new URL("../src/app/studio/editor-contracts.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseDraft, isPendingResponse } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const owner = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const draft = { id: "d28beb9c-6a69-4c3a-841c-7593a8a63265", authorId: owner, title: "Título", content: "Conteúdo de teste", published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  assert.deepEqual(parseDraft(draft, owner), draft);
  assert.throws(() => parseDraft({ ...draft, authorId: "outra" }, owner));
  assert.throws(() => parseDraft({ ...draft, reviewStatus: "UNKNOWN" }, owner));
  assert.throws(() => parseDraft({ ...draft, id: "../invalido" }, owner));
  assert.equal(parseDraft({ ...draft, scheduledAt: "2099-01-01T12:00:00.000Z" }, owner).scheduledAt, "2099-01-01T12:00:00.000Z");
  assert.throws(() => parseDraft({ ...draft, scheduledAt: undefined }, owner));
  assert.throws(() => parseDraft({ ...draft, scheduledAt: "sem data" }, owner));
  assert.equal(isPendingResponse({ status: "PENDING" }), true);
  assert.equal(isPendingResponse({ status: "APPROVED" }), false);
});
