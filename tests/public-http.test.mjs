import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";

const article = {
  id: "98b3fd21-a458-4158-b430-ecb6d9ec7057", slug: "uma-historia", title: "Uma história de teste",
  excerpt: "Resumo de teste", content: '<p>Conteúdo de teste</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>',
  coverImage: null, publishedAt: "2026-01-01T12:00:00Z", published: true, isActive: true,
  readingTimeMinutes: 1, author: { id: "c8fa3cbc-6bbf-4ffa-9f8f-58b7dbe8fe28", name: "Autora de teste" }, categories: [],
};

test("páginas públicas respondem conforme o contrato HTTP", { timeout: 30000 }, async (t) => {
  let lastPostQuery;
  let categoriesDown = false;
  let seriesState = "ok";
  const api = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    response.setHeader("Content-Type", "application/json");
    const meta = { page: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false };
    const category = { id: "c1", slug: "cultura", name: "Cultura", description: "Boas ideias", isActive: true };
    const tag = { id: "t1", slug: "ideias", name: "Ideias" };
    if (url.pathname === "/api/v1/tags") return response.end(JSON.stringify({ data: [tag], meta }));
    if (url.pathname === "/api/v1/tags/ideias") return response.end(JSON.stringify(tag));
    if (url.pathname === `/api/v1/authors/${article.author.id}`) return response.end(JSON.stringify({ id: article.author.id, name: article.author.name, profilePhoto: null, bio: "Biografia de teste", websiteUrl: null, socialUrl: null, publicationCount: 1 }));
    if (url.pathname === "/api/v1/categories") {
      if (categoriesDown) { response.statusCode = 503; return response.end("{}"); }
      return response.end(JSON.stringify({ data: [category], meta }));
    }
    if (url.pathname === "/api/v1/categories/cultura") return response.end(JSON.stringify(category));
    if (url.pathname === "/api/v1/categories/cultura/posts") return response.end(JSON.stringify({ data: [article], meta }));
    if (url.pathname === "/api/v1/sitemap.xml" || url.pathname === "/api/v1/feed/rss") {
      response.setHeader("Content-Type", "application/xml");
      return response.end("<xml>fixture</xml>");
    }
    if (url.pathname === "/api/v1/posts") {
      lastPostQuery = url.searchParams;
      if (url.searchParams.get("search") === "indisponivel") { response.statusCode = 503; return response.end("{}"); }
      if (url.searchParams.get("search") === "vazio") return response.end(JSON.stringify({ data: [], meta: { page: 1, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }));
      if (url.searchParams.get("search") === "paginar") return response.end(JSON.stringify({ data: [article], meta: { page: 1, totalPages: 2, hasNextPage: true, hasPreviousPage: false } }));
      return response.end(JSON.stringify({ data: [article], meta: { page: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } }));
    }
    if (url.pathname === "/api/v1/posts/ausente") { response.statusCode = 404; return response.end("{}"); }
    if (url.pathname === "/api/v1/posts/erro") { response.statusCode = 503; return response.end("{}"); }
    if (url.pathname === `/api/v1/posts/${article.id}/series`) {
      assert.equal(request.headers.authorization, undefined); assert.equal(request.headers.cookie, undefined);
      if (seriesState === "down") { response.statusCode = 503; return response.end("{}"); }
      const posts = [{ id: article.id, slug: article.slug, title: article.title, position: 1 }, { id: "76f781e0-9f94-42a3-ac2a-8dc5a41a983d", slug: "proximo-capitulo", title: "Próximo capítulo", position: 3 }];
      if (seriesState === "draft") posts.push({ id: "8d779824-0a9f-442f-8652-a81600000001", slug: "rascunho-secreto", title: "TITULO PRIVADO", position: 4, published: false });
      return response.end(JSON.stringify({ id: "8d779824-0a9f-442f-8652-a81600000002", title: "Série de teste", description: "Sequência pública", posts, privateToken: "TOKEN PRIVADO" }));
    }
    if (url.pathname === "/api/v1/posts/uma-historia/related") return response.end(JSON.stringify([{ ...article, slug: "outra-historia", title: "Outra leitura" }]));
    if (url.pathname === "/api/v1/posts/rascunho") return response.end(JSON.stringify({ ...article, published: false, content: "CONTEUDO PRIVADO" }));
    if (url.pathname === "/api/v1/posts/antigo" || url.pathname === "/api/v1/posts/uma-historia") return response.end(JSON.stringify(article));
    response.statusCode = 404;
    return response.end("{}");
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  t.after(() => api.close());
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const app = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    env: { ...process.env, API_ORIGIN: `http://127.0.0.1:${api.address().port}` },
    stdio: "ignore",
  });
  t.after(() => app.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) break;
    try { await fetch(base); ready = true; break; } catch { await delay(100); }
  }
  assert.ok(ready, "servidor Next não iniciou; execute o build antes dos testes");

  const home = await fetch(base);
  const homeHtml = await home.text();
  assert.match(homeHtml, /Uma história de teste/);
  assert.match(homeHtml, /href="\/sobre"/);
  assert.match(homeHtml, /PUBLICAÇÃO RECENTE/);
  assert.match(homeHtml, /aria-label="Ler artigo: Uma história de teste"/);
  const about = await fetch(`${base}/sobre`);
  assert.equal(about.status, 200);
  assert.match(await about.text(), /Boas ideias merecem/);
  const search = await fetch(`${base}/?search=paginar&author=Ana&categorySlug=cultura`);
  const searchHtml = await search.text();
  assert.equal(lastPostQuery.get("search"), "paginar");
  assert.equal(lastPostQuery.get("author"), "Ana");
  assert.equal(lastPostQuery.get("categorySlug"), "cultura");
  assert.match(searchHtml, /name="robots" content="noindex/);
  assert.match(searchHtml, /Limpar busca/);
  assert.match(searchHtml, /search=paginar&amp;author=Ana&amp;categorySlug=cultura&amp;page=2#artigos/);
  assert.match(searchHtml, /<option value="cultura" selected="">Cultura<\/option>/);
  categoriesDown = true;
  const fallback = await fetch(`${base}/?categorySlug=cultura`);
  assert.equal(fallback.status, 200);
  assert.match(await fallback.text(), /name="categorySlug" value="cultura"/);
  categoriesDown = false;
  const empty = await fetch(`${base}/?search=vazio`);
  assert.match(await empty.text(), /Nenhum artigo encontrado/);
  const unavailable = await fetch(`${base}/?search=indisponivel`);
  assert.equal(unavailable.status, 500);
  assert.match(await unavailable.text(), /name="robots" content="noindex/);
  assert.equal((await fetch(`${base}/?search=um&search=dois`)).status, 200);
  const categoriesHtml = await (await fetch(`${base}/categorias`)).text();
  assert.match(categoriesHtml, /href="\/tags"/);
  const tagsHtml = await (await fetch(`${base}/tags`)).text();
  assert.match(tagsHtml, /href="\/tags\/ideias"/);
  const tagPage = await fetch(`${base}/tags/ideias`);
  assert.equal(tagPage.status, 200);
  assert.match(await tagPage.text(), /Uma história de teste/);
  assert.equal(lastPostQuery.get("tagSlug"), "ideias");
  assert.equal((await fetch(`${base}/tags/inexistente`)).status, 404);
  assert.match(categoriesHtml, /<title>Categorias \| Entrelinhas<\/title>/);
  assert.match(categoriesHtml, /aria-label="Explorar categoria: Cultura"/);
  const categoryHtml = await (await fetch(`${base}/categorias/cultura`)).text();
  assert.match(categoryHtml, /<title>Cultura \| Entrelinhas<\/title>/);
  assert.match(categoryHtml, /aria-label="Ler artigo: Uma história de teste"/);
  assert.match(await (await fetch(`${base}/categorias/cultura?page=2`)).text(), /<title>Cultura — página 2 \| Entrelinhas<\/title>/);
  assert.equal((await fetch(`${base}/categorias/inexistente`)).status, 404);
  const authorHtml = await (await fetch(`${base}/autores/${article.author.id}`)).text();
  assert.match(authorHtml, /<title>Autora de teste \| Entrelinhas<\/title>/);
  assert.match(authorHtml, /Biografia de teste/);
  assert.match(authorHtml, /Artigos publicados/);
  assert.match(authorHtml, /aria-current="page"[^>]*href="[^"]*aba=artigos/);
  assert.doesNotMatch(authorHtml, /role="tablist"/);
  assert.match(authorHtml, /<a(?=[^>]*href="\/")(?=[^>]*data-back-button="true")[^>]*>/);
  assert.match(authorHtml, /Uma história de teste/);
  assert.match(authorHtml, /aria-label="Ler artigo: Uma história de teste"/);
  const authorAboutHtml = await (await fetch(`${base}/autores/${article.author.id}?aba=sobre`)).text();
  assert.match(authorAboutHtml, /Sobre .*Autora de teste/);
  assert.match(authorAboutHtml, /aria-current="page"[^>]*href="[^"]*aba=sobre/);
  const accountAuthorHtml = await (await fetch(`${base}/autores/${article.author.id}?aba=sobre&origem=conta`)).text();
  assert.match(accountAuthorHtml, /<a(?=[^>]*href="\/conta")(?=[^>]*data-back-button="true")[^>]*>/);
  assert.match(accountAuthorHtml, /aba=artigos&amp;origem=conta/);
  assert.equal((await fetch(`${base}/autores/invalido`)).status, 404);
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<xml>fixture<\/xml>/);
  const feed = await fetch(`${base}/feed/rss`);
  assert.equal(feed.status, 200);
  const post = await fetch(`${base}/posts/uma-historia`);
  const html = await post.text();
  assert.match(html, /aria-label="Ler artigo: Outra leitura"/);
  assert.equal(post.status, 200);
  assert.match(html, /Conteúdo de teste/);
  assert.match(html, /Outra leitura/);
  assert.match(html, /Série de teste/);
  assert.match(html, /href="\/posts\/proximo-capitulo"/);
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /TOKEN PRIVADO/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /href="javascript:/);
  seriesState = "draft";
  const unsafeSeries = await fetch(`${base}/posts/uma-historia`);
  const unsafeHtml = await unsafeSeries.text();
  assert.equal(unsafeSeries.status, 200);
  assert.doesNotMatch(unsafeHtml, /TITULO PRIVADO|rascunho-secreto|Série de teste/);
  seriesState = "down";
  const seriesDown = await fetch(`${base}/posts/uma-historia`);
  assert.equal(seriesDown.status, 200);
  const downHtml = await seriesDown.text();
  assert.match(downHtml, /Conteúdo de teste/);
  assert.doesNotMatch(downHtml, /Série de teste/);
  assert.equal((await fetch(`${base}/posts/ausente`)).status, 404);
  assert.equal((await fetch(`${base}/posts/erro`)).status, 500);
  const draft = await fetch(`${base}/posts/rascunho`);
  assert.equal(draft.status, 500);
  assert.doesNotMatch(await draft.text(), /CONTEUDO PRIVADO/);
  const alias = await fetch(`${base}/posts/antigo`, { redirect: "manual" });
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.get("location"), "/posts/uma-historia");
  assert.equal((await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { Origin: "https://site-invasor.example" } })).status, 403);
  assert.equal((await fetch(`${base}/api/v1/auth/refresh`, { method: "POST" })).status, 403);
});
