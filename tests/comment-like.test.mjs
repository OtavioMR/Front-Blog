import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
test("status de curtida exige booleano e contagem inteira nao negativa", async () => {
  const source = await readFile(new URL("../src/app/posts/[slug]/comment-like-data.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseCommentLike } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  assert.deepEqual(parseCommentLike({ liked: true, likes: 2 }), { liked: true, likes: 2 });
  for (const value of [{ liked: "true", likes: 2 }, { liked: true, likes: -1 }, { liked: false, likes: 1.5 }, null]) assert.throws(() => parseCommentLike(value));
});
