import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/conta/configuracoes/deactivate-account.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { deactivateAccount } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const subject = "4c781e0d-b963-493c-b2df-0a8fa66c0615";

test("desativa somente o titular confirmado e invalida a sessão", async () => {
  let requests = 0; const invalidations = [];
  const result = await deactivateAccount(async (id, path, init) => {
    requests++; assert.equal(id, subject); assert.equal(path, `/api/v1/users/${subject}`); assert.equal(init.method, "DELETE");
    return new Response(null, { status: 204 });
  }, async id => { invalidations.push(id); return true; }, subject);
  assert.equal(result, "deleted"); assert.equal(requests, 1); assert.deepEqual(invalidations, [subject]);
});

test("não repete falhas incertas e não invalida uma conta trocada", async () => {
  let requests = 0; const invalidations = [];
  const invalidate = async id => { invalidations.push(id); return true; };
  assert.equal(await deactivateAccount(async () => { requests++; throw new Error("rede"); }, invalidate, subject), "uncertain");
  assert.equal(requests, 1); assert.deepEqual(invalidations, [subject]);
  for (const [status, expected] of [[401, "unauthorized"], [403, "forbidden"], [409, "changed"]]) {
    assert.equal(await deactivateAccount(async () => new Response(null, { status }), invalidate, subject), expected);
  }
  assert.deepEqual(invalidations, [subject]);
  assert.equal(await deactivateAccount(async () => { throw new Error("não deve chamar"); }, invalidate, "inválido"), "uncertain");
});
