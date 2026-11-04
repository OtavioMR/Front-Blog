import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/conta/senha/contracts.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, TextEncoder };
vm.runInNewContext(compiled, context);
const { passwordPayload } = context.exports;

test("envia somente senha atual e nova senha ao backend", () => {
  const payload = passwordPayload("fixture-current", "fixture-new-pass", "fixture-new-pass");
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { currentPassword: "fixture-current", password: "fixture-new-pass" });
});

test("valida tamanho, confirmação e limite de bytes UTF-8", () => {
  assert.throws(() => passwordPayload("", "fixture-new-pass", "fixture-new-pass"));
  assert.throws(() => passwordPayload("current", "short", "short"));
  assert.throws(() => passwordPayload("current", "fixture-new-pass", "different"));
  assert.throws(() => passwordPayload("current", "é".repeat(37), "é".repeat(37)));
  assert.throws(() => passwordPayload("é".repeat(37), "fixture-new-pass", "fixture-new-pass"));
});
