import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import ts from "typescript";

async function loadRelatedModule() {
  const source = await readFile(
    new URL("../src/app/posts/[slug]/related.ts", import.meta.url),
    "utf8"
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

test("recomendações priorizam relacionados, mesmo autor, gerais e fallback inteligente", async (t) => {
  const currentPost = {
    id: "10b24920-2ac3-48fe-9f91-c1e7446255ec",
    slug: "entre-linhas-de-codigo-e-silencios",
    authorId: "9aa6a0de-69b9-4eda-af27-a6827e3b370f",
  };

  const authorOtherPost = {
    id: "a1111111-1111-1111-1111-111111111111",
    slug: "artigo-do-mesmo-autor",
    title: "Artigo do Mesmo Autor",
    excerpt: "Outro texto do mesmo autor",
    readingTimeMinutes: 3,
    published: true,
    isActive: true,
    author: { id: currentPost.authorId, name: "Otávio" },
  };

  const generalPost1 = {
    id: "g1111111-1111-1111-1111-111111111111",
    slug: "geral-post-1",
    title: "Geral 1",
    excerpt: "Resumo 1",
    readingTimeMinutes: 4,
    published: true,
    isActive: true,
    author: { id: "author-2", name: "Outro Autor" },
  };

  const generalPost2 = {
    id: "g2222222-2222-2222-2222-222222222222",
    slug: "geral-post-2",
    title: "Geral 2",
    excerpt: "Resumo 2",
    readingTimeMinutes: 5,
    published: true,
    isActive: true,
    author: { id: "author-3", name: "Mais Um" },
  };

  const generalPost3 = {
    id: "g3333333-3333-3333-3333-333333333333",
    slug: "geral-post-3",
    title: "Geral 3",
    excerpt: "Resumo 3",
    readingTimeMinutes: 2,
    published: true,
    isActive: true,
  };

  const unpublishedPost = {
    id: "u4444444-4444-4444-4444-444444444444",
    slug: "rascunho-invalido",
    title: "Rascunho",
    excerpt: "Nao publicado",
    readingTimeMinutes: 2,
    published: false,
    isActive: true,
  };

  let relatedResponse = [];
  let authorResponse = [authorOtherPost];
  let generalResponse = [generalPost1, generalPost2, generalPost3, unpublishedPost];

  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = new URL(req.url, "http://127.0.0.1");

    if (url.pathname === `/api/v1/posts/${encodeURIComponent(currentPost.slug)}/related`) {
      return res.end(JSON.stringify(relatedResponse));
    }
    if (url.pathname === "/api/v1/posts") {
      if (url.searchParams.get("authorId") === currentPost.authorId) {
        return res.end(JSON.stringify({ data: authorResponse }));
      }
      return res.end(JSON.stringify({ data: generalResponse }));
    }

    res.statusCode = 404;
    res.end("{}");
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const prevOrigin = process.env.API_ORIGIN;
  process.env.API_ORIGIN = `http://127.0.0.1:${server.address().port}`;
  t.after(() => {
    process.env.API_ORIGIN = prevOrigin;
  });

  const { getRelatedPosts } = await loadRelatedModule();

  // Caso 1: Sem posts relacionados (como o artigo do relato), busca autor e depois geral
  const recs = await getRelatedPosts(currentPost);
  assert.ok(Array.isArray(recs));
  assert.equal(recs.length, 4);
  assert.equal(recs[0].slug, "artigo-do-mesmo-autor");
  assert.equal(recs[1].slug, "geral-post-1");
  assert.equal(recs[2].slug, "geral-post-2");
  assert.equal(recs[3].slug, "geral-post-3");
  // Nunca inclui rascunho
  assert.ok(!recs.some((r) => r.slug === "rascunho-invalido"));
  // Nunca inclui o artigo atual
  assert.ok(!recs.some((r) => r.slug === currentPost.slug || r.id === currentPost.id));

  // Caso 2: Artigo tem posts relacionados suficientes (Tier 1)
  relatedResponse = [
    { ...generalPost1, id: "r1111111-1111-1111-1111-111111111111", slug: "rel-1", title: "Relacionado 1" },
    { ...generalPost2, id: "r2222222-2222-2222-2222-222222222222", slug: "rel-2", title: "Relacionado 2" },
  ];
  const recsWithTier1 = await getRelatedPosts(currentPost);
  assert.equal(recsWithTier1.length, 4);
  assert.equal(recsWithTier1[0].slug, "rel-1");
  assert.equal(recsWithTier1[1].slug, "rel-2");
  assert.equal(recsWithTier1[2].slug, "artigo-do-mesmo-autor");
  assert.equal(recsWithTier1[3].slug, "geral-post-1");

  // Caso 3: Fallback inteligente quando há poucos artigos disponíveis no total (apenas 2)
  relatedResponse = [];
  authorResponse = [];
  generalResponse = [generalPost1, generalPost2];
  const recsFew = await getRelatedPosts(currentPost);
  assert.equal(recsFew.length, 2);
  assert.equal(recsFew[0].slug, "geral-post-1");
  assert.equal(recsFew[1].slug, "geral-post-2");

  // Caso 4: Nenhum outro artigo elegível disponível (apenas o próprio post)
  generalResponse = [
    {
      id: currentPost.id,
      slug: currentPost.slug,
      title: "Entre Linhas",
      excerpt: "...",
      published: true,
      isActive: true,
      readingTimeMinutes: 2,
    },
  ];
  const recsNone = await getRelatedPosts(currentPost);
  assert.equal(recsNone.length, 0);

  // Caso 5: Compatibilidade com chamada passando string slug
  generalResponse = [generalPost1];
  const recsSlugOnly = await getRelatedPosts("outro-slug-qualquer");
  assert.equal(recsSlugOnly.length, 1);
  assert.equal(recsSlugOnly[0].slug, "geral-post-1");
});

test("navbar não contém símbolo de estrela ✳ associado ao título do blog", async () => {
  const source = await readFile(
    new URL("../src/app/_components/navbar.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(!source.includes("✳"), "Símbolo ✳ não deve estar presente no navbar");
  assert.ok(!source.includes("brandMark"), "Classe brandMark não deve estar presente no navbar");
  assert.ok(source.includes("entrelinhas"), "Nome do blog 'entrelinhas' deve estar presente");
  assert.ok(source.includes("icone-livro-claro.svg"), "Ícone do livro claro deve estar no navbar");
  assert.ok(source.includes("icone-livro-escuro.svg"), "Ícone do livro escuro deve estar no navbar");
});
