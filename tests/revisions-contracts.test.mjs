import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const editor = compile(await readFile(new URL("../src/app/studio/editor-contracts.ts", import.meta.url), "utf8"));
const source = compile(await readFile(new URL("../src/app/studio/revisions-contracts.ts", import.meta.url), "utf8")).replace('"./editor-contracts"', `"data:text/javascript;base64,${Buffer.from(editor).toString("base64")}"`);
const { parseRevisions, parseRevision, parseRestored } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615", rev = "76f781e0-9f94-42a3-ac2a-8dc5a41a983d";
const entry = { id: rev, title: "Versao sintetica", content: "Texto sintetico", createdAt: "2026-01-01T00:00:00Z" };

test("valida paginação, identificação e conteúdo das revisões", () => {
  assert.equal(parseRevisions({ data: [entry], meta: { page: 1, hasNextPage: false, hasPreviousPage: false } }, 1).items[0].id, rev);
  assert.equal(parseRevision(entry, rev).content, entry.content);
  assert.throws(() => parseRevision(entry, id));
  assert.throws(() => parseRevisions({ data: [entry, entry], meta: { page: 1, hasNextPage: false, hasPreviousPage: false } }, 1));
  assert.throws(() => parseRevisions({ data: [], meta: { page: 2, hasNextPage: false, hasPreviousPage: false } }, 1));
});

test("restauração confirma titular, artigo e bloqueio de revisão", () => {
  const draft = { id, authorId: id, title: "Titulo", content: "Conteudo sintetico", published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  assert.equal(parseRestored(draft, id, false, id).id, id);
  const withoutActive = { ...draft }; delete withoutActive.isActive;
  assert.equal(parseRestored(withoutActive, id, false, id).id, id);
  assert.throws(() => parseRestored({ ...draft, isActive: false }, id, false, id));
  assert.throws(() => parseRestored({ ...draft, reviewStatus: "PENDING" }, id, false, id));
  assert.throws(() => parseRestored(draft, rev, false, id));
  assert.throws(() => parseRestored(draft, id, false, rev));
});
