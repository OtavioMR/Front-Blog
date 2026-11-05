import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
test("feed valida paginacao e dados publicos antes de renderizar", async () => {
  const source = await readFile(new URL("../src/app/conta/feed/data.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseFeed } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const item = { id, slug: "artigo", title: "Artigo", excerpt: "Resumo", publishedAt: "2026-01-01T00:00:00Z", author: { id, name: "Autor" } };
  const feed = { data: [item], meta: { page: 1, hasNextPage: false, hasPreviousPage: false } };
  assert.equal(parseFeed(feed, 1).data[0].title, "Artigo");
  assert.throws(() => parseFeed(feed, 2));
  assert.throws(() => parseFeed({ ...feed, data: [{ ...item, publishedAt: "invalido" }] }, 1));
  assert.throws(() => parseFeed({ ...feed, data: [{ ...item, author: { id: "invalido", name: "Autor" } }] }, 1));
  assert.throws(() => parseFeed({ ...feed, data: Array(11).fill(item) }, 1));
});
