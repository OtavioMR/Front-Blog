import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/posts/[slug]/comment-manage.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { manageComment } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const subject = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
const id = "d28beb9c-6a69-4c3a-841c-7593a8a63265";

test("edição valida entrada e resposta e usa a identidade esperada", async () => {
  let calls = 0;
  const fetcher = async (owner, path, init) => {
    calls++; assert.equal(owner, subject); assert.equal(path, `/api/v1/comments/${id}`);
    assert.equal(init.method, "PATCH"); assert.deepEqual(JSON.parse(init.body), { content: "novo texto" });
    return Response.json({ id, isActive: true, content: "novo texto", editedAt: "2026-01-01T00:00:00Z" });
  };
  assert.equal((await manageComment(fetcher, subject, id, "PATCH", "  ")).kind, "invalid");
  assert.equal((await manageComment(fetcher, subject, id, "PATCH", "novo texto")).kind, "updated");
  assert.equal(calls, 1);
  assert.equal((await manageComment(async () => Response.json({ id: "outro", isActive: true, content: "x", editedAt: "2026-01-01T00:00:00Z" }), subject, id, "PATCH", "x")).kind, "uncertain");
});

test("desativação reconhece 204 e não repete resultado incerto", async () => {
  let calls = 0;
  assert.equal((await manageComment(async (owner, path, init) => { calls++; assert.equal(owner, subject); assert.equal(path, `/api/v1/comments/${id}`); assert.equal(init.method, "DELETE"); return new Response(null, { status: 204 }); }, subject, id, "DELETE")).kind, "deleted");
  assert.equal((await manageComment(async () => { calls++; throw new Error("rede"); }, subject, id, "DELETE")).kind, "uncertain");
  assert.equal(calls, 2);
  for (const [status, kind] of [[401, "unauthorized"], [403, "forbidden"], [404, "missing"], [409, "changed"]]) assert.equal((await manageComment(async () => new Response(null, { status }), subject, id, "DELETE")).kind, kind);
});
