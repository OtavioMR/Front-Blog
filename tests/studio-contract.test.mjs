import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/studio/contracts.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { parseRules, parseOwnArticles, acceptedRules } = context.exports;

test("regras exigem versão e lista de textos", () => {
  assert.equal(parseRules({ version: "1", rules: ["Regra de teste"] }).version, "1");
  assert.throws(() => parseRules({ version: "", rules: [] }));
  assert.throws(() => parseRules({ version: "1", rules: [null] }));
});

test("aceite só é confirmado para papel e versão esperados", () => {
  assert.equal(acceptedRules({ role: "AUTHOR", rulesVersion: "1" }, "1"), true);
  assert.equal(acceptedRules({ role: "READER", rulesVersion: "1" }, "1"), false);
  assert.equal(acceptedRules({ role: "AUTHOR", rulesVersion: "2" }, "1"), false);
});

test("listagem própria valida os campos e paginação antes de exibir", () => {
  const page = { data: [{ id: "id", title: "Rascunho", slug: "rascunho", published: false, reviewStatus: "PENDING" }], meta: { page: 1, hasNextPage: false, hasPreviousPage: false } };
  assert.equal(parseOwnArticles(page).data[0].reviewStatus, "PENDING");
  assert.throws(() => parseOwnArticles({ ...page, meta: {} }));
  assert.throws(() => parseOwnArticles({ ...page, data: [{ ...page.data[0], published: "false" }] }));
});
