import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/conta/salvos/collections-data.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { parseCollections, parseCollectionPosts } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
test("valida coleções privadas e descarta campos adicionais", () => {
  const item = { id, name: "Leituras", createdAt: "2026-01-01T00:00:00Z", privateField: "fixture" };
  assert.deepEqual(parseCollections([item]), [{ id, name: item.name, createdAt: item.createdAt }]);
  assert.throws(() => parseCollections([item, item]));
  assert.throws(() => parseCollections([{ ...item, name: " " }]));
});
test("valida paginação e links públicos de artigos da coleção", () => {
  const post = { id, slug: "artigo-sintetico", title: "Artigo", excerpt: "Resumo" };
  const value = { data: [post], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } };
  assert.equal(parseCollectionPosts(value, 1).items[0].slug, post.slug);
  assert.throws(() => parseCollectionPosts(value, 2));
  assert.throws(() => parseCollectionPosts({ ...value, data: [{ ...post, slug: "//externo" }] }, 1));
  assert.throws(() => parseCollectionPosts({ ...value, data: [{ ...post, published: false }] }, 1));
});
