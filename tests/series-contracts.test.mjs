import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("contratos privados validam autor, lista, ordem e resposta", async () => {
  const source = await readFile(new URL("../src/app/studio/series/contracts.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseSeriesList, parseDetail, confirmedItems } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const owner = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const id = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const postId = "b1a7d654-2a6c-4876-b9b6-79cf021516e8";
  const series = { id, authorId: owner, title: "Series", description: "", createdAt: "2099-01-01T00:00:00Z", updatedAt: "2099-01-01T00:00:00Z" };
  const post = { id: postId, title: "Draft", slug: "draft", published: false, isActive: true, position: 1 };
  assert.equal(parseSeriesList([series], owner).length, 1);
  assert.throws(() => parseSeriesList([{ ...series, authorId: "other" }], owner));
  assert.throws(() => parseSeriesList(Array(101).fill(series), owner));
  assert.equal(parseDetail({ ...series, posts: [post] }, owner, id).posts[0].published, false);
  assert.throws(() => parseDetail({ ...series, posts: [post, post] }, owner, id));
  assert.throws(() => parseDetail({ ...series, posts: [{ ...post, id: "invalid" }] }, owner, id));
  assert.equal(confirmedItems({ postIds: [postId] }, [postId]), true);
  assert.equal(confirmedItems({ postIds: [] }, [postId]), false);
});
