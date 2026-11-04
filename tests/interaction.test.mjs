import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/posts/[slug]/interaction-data.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { parseInteraction, changeInteraction } = context.exports;
const post = "00000000-0000-4000-8000-000000000001";
const subject = "00000000-0000-4000-8000-000000000002";

test("valida os campos retornados pela API", () => {
  assert.equal(parseInteraction({ liked: true, saved: false, likes: 3 }).likes, 3);
  for (const bad of [{ liked: true, saved: false, likes: -1 }, { liked: "true", saved: false, likes: 0 }, { liked: false, saved: false, likes: 1.5 }]) assert.throws(() => parseInteraction(bad));
});

test("mutações enviam sujeito e método corretos, sem repetir em falha", async () => {
  const calls = [];
  const mock = async (...args) => { calls.push(args); return { status: 204 }; };
  const state = { liked: false, saved: true, likes: 2 };
  assert.equal((await changeInteraction(mock, subject, post, "like", state)).status, 204);
  assert.equal((await changeInteraction(mock, subject, post, "save", state)).status, 204);
  assert.equal(calls[0][0], subject);
  assert.equal(calls[0][1], `/api/v1/posts/${post}/like`);
  assert.equal(calls[0][2].method, "PUT");
  assert.equal(calls[1][1], `/api/v1/posts/${post}/save`);
  assert.equal(calls[1][2].method, "DELETE");
  let attempts = 0;
  await assert.rejects(changeInteraction(async () => { attempts++; throw new Error("connection lost"); }, subject, post, "like", state));
  assert.equal(attempts, 1);
  assert.throws(() => changeInteraction(mock, subject, "invalid", "like", state));
});
