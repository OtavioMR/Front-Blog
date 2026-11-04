import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/conta/perfil/contracts.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, URL };
vm.runInNewContext(compiled, context);
const { parseProfile, profilePayload } = context.exports;

test("perfil valida campos retornados pela API", () => {
  assert.equal(parseProfile({ name: "Autora", bio: null, websiteUrl: null, socialUrl: null }).bio, "");
  assert.throws(() => parseProfile({ name: "Autora", bio: null }));
});

test("payload contém apenas campos editáveis e permite limpar dados", () => {
  const payload = profilePayload({ name: " Autora ", bio: " ", websiteUrl: "", socialUrl: "https://example.test/perfil" });
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { name: "Autora", bio: null, websiteUrl: null, socialUrl: "https://example.test/perfil" });
});

test("rejeita nome inválido, biografia longa e URLs inseguras", () => {
  const valid = { name: "Autora", bio: "", websiteUrl: "", socialUrl: "" };
  assert.throws(() => profilePayload({ ...valid, name: " " }));
  assert.throws(() => profilePayload({ ...valid, bio: "a".repeat(501) }));
  assert.throws(() => profilePayload({ ...valid, websiteUrl: "javascript:alert(1)" }));
  assert.throws(() => profilePayload({ ...valid, socialUrl: "https://user:pass@example.test/" }));
});
