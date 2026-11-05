import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/conta/email/contracts.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { emailPayload, requestEmailChange } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const subject = "4c781e0d-b963-493c-b2df-0a8fa66c0615";

test("valida endereço, alteração e senha conforme limites do contrato", () => {
  assert.deepEqual(emailPayload(" Novo@Example.test ", "fixture-pass", "atual@example.test"), { email: "novo@example.test", currentPassword: "fixture-pass" });
  assert.throws(() => emailPayload("inválido", "fixture-pass", "atual@example.test"));
  assert.throws(() => emailPayload("ATUAL@example.test", "fixture-pass", "atual@example.test"));
  assert.throws(() => emailPayload("novo@example.test", "é".repeat(37), "atual@example.test"));
});

test("envia ao titular e trata respostas ambíguas sem repetir", async () => {
  let calls = 0;
  const payload = { email: "novo@example.test", currentPassword: "fixture-pass" };
  const result = await requestEmailChange(async (id, path, init) => {
    calls++; assert.equal(id, subject); assert.equal(path, `/api/v1/users/${subject}`);
    assert.equal(init.method, "PATCH"); assert.deepEqual(JSON.parse(init.body), payload);
    return Response.json({ id: subject });
  }, subject, payload);
  assert.equal(result, "requested");
  for (const [status, expected] of [[400, "invalid"], [401, "unauthorized"], [403, "forbidden"], [409, "conflict"], [500, "uncertain"]]) {
    assert.equal(await requestEmailChange(async () => new Response(null, { status }), subject, payload), expected);
  }
  assert.equal(await requestEmailChange(async () => Response.json({ id: "other" }), subject, payload), "uncertain");
  assert.equal(await requestEmailChange(async () => { calls++; throw new Error("rede"); }, subject, payload), "uncertain");
  assert.equal(calls, 2);
});
