import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import ts from "typescript";

test("respostas são carregadas anonimamente, paginadas e validadas", async t => {
  const postId = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const rootId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  let status = 200;
  let root = rootId;
  const server = createServer((request, response) => {
    assert.equal(request.url, `/api/v1/posts/${postId}/comments/${rootId}/replies?page=2&limit=5`);
    assert.equal(request.headers.authorization, undefined); assert.equal(request.headers.cookie, undefined);
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "c18beb9c-6a69-4c3a-841c-7593a8a63265", postId, rootId: root, author: { name: "Leitor" }, content: "Resposta", isActive: true, createdAt: "2026-01-01T00:00:00Z", editedAt: null }], meta: { page: 2, total: 6, hasNextPage: false } }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.close());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (path, options) => originalFetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  t.after(() => { globalThis.fetch = originalFetch; });
  const source = await readFile(new URL("../src/app/posts/[slug]/replies-data.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { fetchReplies } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const result = await fetchReplies(postId, rootId, 2);
  assert.equal(result.data[0].content, "Resposta"); assert.equal(result.meta.hasNextPage, false);
  root = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  await assert.rejects(fetchReplies(postId, rootId, 2), /inválida/);
  status = 503; await assert.rejects(fetchReplies(postId, rootId, 2), /indisponíveis/);
  await assert.rejects(fetchReplies("../invalid", rootId, 2), /inválida/);
});
