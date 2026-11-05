import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/studio/remove-article.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { removeArticleRequest, canConfirmRemoval } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const owner = "4c781e0d-b963-493c-b2df-0a8fa66c0615", id = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
test("desativação usa titular e confirma somente 204 sem repetir falhas", async () => {
  let calls = 0;
  const fetcher = async (subject, path, init) => { calls++; assert.equal(subject, owner); assert.equal(path, `/api/v1/posts/${id}`); assert.equal(init.method, "DELETE"); return new Response(null, { status: 204 }); };
  assert.equal(await removeArticleRequest(fetcher, owner, id), "deleted");
  assert.equal(await removeArticleRequest(fetcher, owner, "inválido"), "uncertain");
  assert.equal(calls, 1);
  for (const [status, result] of [[401, "unauthorized"], [403, "forbidden"], [404, "missing"], [409, "changed"], [500, "uncertain"]]) assert.equal(await removeArticleRequest(async () => new Response(null, { status }), owner, id), result);
  assert.equal(await removeArticleRequest(async () => { calls++; throw new Error("rede"); }, owner, id), "uncertain");
  assert.equal(calls, 2);
});

test("confirmacao pertence a conta que abriu a caixa", () => {
  assert.equal(canConfirmRemoval(owner, owner), true);
  assert.equal(canConfirmRemoval(owner, "outra-conta"), false);
  assert.equal(canConfirmRemoval(owner, ""), false);
  assert.equal(canConfirmRemoval("", ""), false);
});
