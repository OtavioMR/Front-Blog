import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import ts from "typescript";

test("comentários públicos usam a API por UUID e distinguem vazio, bloqueio e falha", async t => {
  const postId = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const rootId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  let status = 200;
  let body = { data: [{ id: rootId, postId, rootId: null, author: { name: "Pessoa de teste" }, content: "Comentário de teste", isActive: true, createdAt: "2026-01-01T00:00:00Z", editedAt: null, replies: { data: [], meta: { total: 0 } } }], meta: { page: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
  const api = createServer((request, response) => {
    assert.equal(request.url, `/api/v1/posts/${postId}/comments?page=1&limit=10`);
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  api.listen(0, "127.0.0.1"); await once(api, "listening"); t.after(() => api.close());
  const oldOrigin = process.env.API_ORIGIN;
  process.env.API_ORIGIN = `http://127.0.0.1:${api.address().port}`;
  t.after(() => { if (oldOrigin === undefined) delete process.env.API_ORIGIN; else process.env.API_ORIGIN = oldOrigin; });
  const source = await readFile(new URL("../src/app/posts/[slug]/comments.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { getComments, commentsPage } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  assert.equal((await getComments(postId, 1)).page.data[0].content, "Comentário de teste");
  body = { data: [], meta: { page: 1, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
  assert.equal((await getComments(postId, 1)).page.data.length, 0);
  status = 403; assert.equal((await getComments(postId, 1)).kind, "disabled");
  status = 503; assert.equal((await getComments(postId, 1)).kind, "unavailable");
  assert.equal((await getComments("invalido", 1)).kind, "unavailable");
  assert.equal(commentsPage("2"), 2); assert.equal(commentsPage("-1"), 1);
});
