import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/app/conta/salvos/data.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { parseSavedPage, loadSavedPage, loadOwnedSavedPage } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const item = { id: "4c781e0d-b963-493c-b2df-0a8fa66c0615", title: "Exemplo", excerpt: "Resumo", author: { name: "Autora" }, published: true, isActive: true };
const meta = { page: 1, limit: 10, total: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
test("valida dados públicos e metadados da lista privada", () => {
  assert.equal(parseSavedPage({ data: [item], meta }, 1).data[0].id, item.id);
  assert.deepEqual(parseSavedPage({ data: [], meta: { ...meta, total: 0, totalPages: 0 } }, 1).data, []);
  for (const bad of [{ ...item, id: "../conta" }, { ...item, published: false }, { ...item, author: null }]) assert.throws(() => parseSavedPage({ data: [bad], meta }, 1));
  assert.throws(() => parseSavedPage({ data: [item], meta: { ...meta, page: 2 } }, 1));
  assert.throws(() => parseSavedPage({ data: [item], meta: { ...meta, hasNextPage: true } }, 1));
  assert.throws(() => parseSavedPage({ data: [item, item], meta: { ...meta, total: 2 } }, 1));
  assert.equal(parseSavedPage({ data: [], meta: { ...meta, page: 2, hasPreviousPage: true } }, 2).meta.page, 2);
});

test("lista de salvos é vinculada ao titular e recusa troca de conta", async () => {
  let calls = 0;
  const getProfile = async () => ({ id: item.id });
  const fetchForSubject = async (subject, path) => { calls++; assert.equal(subject, item.id); assert.equal(path, "/api/v1/posts/saved?page=1&limit=10"); return new Response(null, { status: 409 }); };
  await assert.rejects(loadOwnedSavedPage(1, getProfile, fetchForSubject));
  assert.equal(calls, 1);
  assert.equal((await loadOwnedSavedPage(1, async () => null, fetchForSubject)).state, "signed-out");
  assert.equal(calls, 1);
  const result = await loadOwnedSavedPage(1, getProfile, async subject => { assert.equal(subject, item.id); return Response.json({ data: [item], meta }); });
  assert.equal(result.owner, item.id); assert.equal(result.state, "ready");
});

test("consulta autenticada trata paginação, sessão e falha sem dados reais", async () => {
  let path;
  const fetcher = async value => { path = value; return Response.json({ data: [item], meta }); };
  assert.equal((await loadSavedPage(1, fetcher)).state, "ready");
  assert.equal(path, "/api/v1/posts/saved?page=1&limit=10");
  assert.equal((await loadSavedPage(1, async () => new Response(null, { status: 401 }))).state, "signed-out");
  assert.equal((await loadSavedPage(1, async () => new Response(null, { status: 403 }))).state, "forbidden");
  await assert.rejects(loadSavedPage(1, async () => new Response(null, { status: 500 })));
  await assert.rejects(loadSavedPage(1, async () => Response.json({ data: "inválido", meta })));
});
