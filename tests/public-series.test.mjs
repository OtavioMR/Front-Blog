import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/posts/[slug]/series.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { getPublicSeries } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615", next = "76f781e0-9f94-42a3-ac2a-8dc5a41a983d";
const fixture = () => ({ id: "8d779824-0a9f-442f-8652-a81600000001", title: "Série sintética", description: "Descrição", posts: [{ id, slug: "primeiro", title: "Primeiro", position: 1 }, { id: next, slug: "segundo", title: "Segundo", position: 3 }] });

test("consulta anônima e não cacheada usa somente a rota pública", async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (url, options) => { assert.match(url, new RegExp(`/api/v1/posts/${id}/series$`)); assert.equal(options.cache, "no-store"); assert.equal(options.headers.Authorization, undefined); return Response.json(fixture()); };
  const result = await getPublicSeries(id, "primeiro"); assert.equal(result.posts.length, 2); assert.equal(result.posts[1].position, 3);
});

test("respostas indisponíveis, incoerentes ou com links inseguros são omitidas", async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
  for (const status of [404, 500]) { globalThis.fetch = async () => new Response(null, { status }); assert.equal(await getPublicSeries(id, "primeiro"), null); }
  for (const change of [v => { v.posts[1].slug = "//externo"; }, v => { v.posts[1].published = false; }, v => { v.posts[1].position = 1; }, v => { v.posts[0].id = next; }]) {
    const value = fixture(); change(value); globalThis.fetch = async () => Response.json(value); assert.equal(await getPublicSeries(id, "primeiro"), null);
  }
  globalThis.fetch = async () => { throw new Error("offline"); }; assert.equal(await getPublicSeries(id, "primeiro"), null);
});
