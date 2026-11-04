import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("criação envia conteúdo à conta correta uma vez e identifica resultado incerto", async () => {
  const source = await readFile(new URL("../src/app/posts/[slug]/comment-create.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { createComment } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const subject = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  let calls = 0;
  const send = async (expected, path, init) => {
    calls++; assert.equal(expected, subject); assert.equal(path, `/api/v1/posts/${postId}/comments`); assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { content: "Olá" });
    return Response.json({ id: "c18beb9c-6a69-4c3a-841c-7593a8a63265", postId, rootId: null, replyToId: null, isActive: true, author: { id: subject }, content: "Olá" }, { status: 201 });
  };
  assert.equal(await createComment(send, subject, postId, "Olá"), "created"); assert.equal(calls, 1);
  assert.equal(await createComment(send, subject, postId, "  "), "invalid"); assert.equal(calls, 1);
  assert.equal(await createComment(async () => new Response(null, { status: 403 }), subject, postId, "Olá"), "disabled");
  assert.equal(await createComment(async () => new Response(null, { status: 409 }), subject, postId, "Olá"), "changed");
  let attempts = 0;
  assert.equal(await createComment(async () => { attempts++; throw new Error("rede"); }, subject, postId, "Olá"), "uncertain"); assert.equal(attempts, 1);
});


test("resposta informa o coment\u00e1rio alvo e valida a conversa retornada", async () => {
  const source = await readFile(new URL("../src/app/posts/[slug]/comment-create.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { createComment } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const subject = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const rootId = "c18beb9c-6a69-4c3a-841c-7593a8a63265";
  const result = { id: "e18beb9c-6a69-4c3a-841c-7593a8a63265", postId, rootId, replyToId: rootId, isActive: true, author: { id: subject }, content: "Resposta" };
  let calls = 0;
  const send = async (expected, path, init) => {
    calls++;
    assert.equal(expected, subject);
    assert.equal(path, `/api/v1/posts/${postId}/comments`);
    assert.deepEqual(JSON.parse(init.body), { content: "Resposta", replyToId: rootId });
    return Response.json(result, { status: 201 });
  };
  assert.equal(await createComment(send, subject, postId, "Resposta", rootId), "created");
  assert.equal(await createComment(send, subject, postId, "Resposta", "invalido"), "invalid");
  assert.equal(calls, 1);
  assert.equal(await createComment(async () => Response.json({ ...result, rootId: null }, { status: 201 }), subject, postId, "Resposta", rootId), "uncertain");
});
