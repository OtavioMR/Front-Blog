import { v2FixtureResponse } from "./support/v2-response.mjs";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { cp, lstat, mkdir, mkdtemp, readlink, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

// Execute: node --test tests/series-browser.test.mjs
// Requires Node 22+ and a Chromium executable in CHROME_PATH (defaults to Edge on Windows).
// A temporary project and API are used; no requests reach the configured backend.
test("autor gerencia series e protege alteracoes em layouts responsivos", { timeout: 180000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-series-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const authorId = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const seriesTitle = "Série sintética de viagens extraordinárias: memórias de uma biblioteca, seus leitores e os caminhos que se cruzam depois da última página";
  const chapterTitle = "Capítulo sintético sobre as histórias que atravessam o tempo e encontram novos leitores em uma pequena biblioteca de portas abertas";
  const description = "Esta descrição sintética apresenta uma série de viagens, encontros e descobertas em uma biblioteca imaginária. Cada capítulo acompanha personagens que compartilham histórias e encontram novas perspectivas. ".repeat(5).slice(0, 980);
  const coverImage = "/uploads/post-covers/synthetic-portrait.webp";
  const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#173c54"/><stop offset="1" stop-color="#c96838"/></linearGradient></defs><rect width="480" height="720" fill="url(#bg)"/><circle cx="245" cy="260" r="140" fill="#edb269"/><path d="M0 540L190 300 480 600V720H0Z" fill="#244b45"/><path d="M0 650L300 390 480 590V720H0Z" fill="#162e39"/><text x="240" y="90" text-anchor="middle" fill="white" font-size="24" font-family="serif">CAPA SINTÉTICA</text></svg>`;
  const token = (role) => `test.${Buffer.from(JSON.stringify({ sub: authorId, role })).toString("base64url")}.test`;
  let post = { id: postId, authorId, title: chapterTitle, slug: "synthetic-title", content: "Synthetic article content.", coverImage, published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  const seriesId = "2334ab64-c5a9-41d4-a063-5b0120b4b45f";
  let series = null, items = [];
  const api = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(v2FixtureResponse(data, req, res))); };
    if (req.method === "GET" && req.url === coverImage) { res.setHeader("Content-Type", "image/svg+xml"); return res.end(coverSvg); }
    if (req.method === "GET" && req.url.startsWith("/api/v1/posts?")) return respond(200, { data: [{ ...post, title: chapterTitle, excerpt: description.slice(0, 210), coverImage, published: true, isActive: true, publishedAt: "2026-01-01T00:00:00Z", readingTimeMinutes: 7, author: { id: authorId, name: "Autora sintética" }, categories: [{ name: "Ficção sintética" }], discoverySeries: { id: seriesId, title: seriesTitle, description, coverImage, publishedCount: 1, contentRating: "L" } }], meta: { page: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });
    if (req.method === "GET" && req.url.startsWith("/api/v1/categories?")) return respond(200, { data: [{ slug: "ficcao-sintetica", name: "Ficção sintética", isActive: true }] });
    if (req.method === "POST" && req.url === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (role === "AUTHOR") res.setHeader("Set-Cookie", "refreshToken=synthetic; HttpOnly; Path=/api/v1/auth; SameSite=Strict");
      return ["AUTHOR", "ADMIN"].includes(role) ? respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    }
    if (req.method === "POST" && req.url === "/api/v1/auth/refresh/v2") return req.headers.cookie?.includes("refreshToken=synthetic") ? respond(200, { access_token: token("AUTHOR"), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const role = bearer === token("AUTHOR") ? "AUTHOR" : bearer === token("ADMIN") ? "ADMIN" : "";
    if (!role) return respond(401, {});
    if (req.url === "/api/v1/series/me" && req.method === "GET") return respond(200, series ? [series] : []);
    if (req.url === "/api/v1/series" && req.method === "POST") { series = { id: seriesId, authorId, ...JSON.parse(body), coverImage, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }; return respond(201, series); }
    if (req.url === `/api/v1/series/${seriesId}` && req.method === "PATCH") { Object.assign(series, JSON.parse(body), { updatedAt: "2026-01-03T00:00:00Z" }); return respond(200, series); }
    if (req.url === `/api/v1/series/${seriesId}/manage` && req.method === "GET") return respond(200, { ...series, posts: items });
    if (req.url === `/api/v1/series/${seriesId}/items` && req.method === "PUT") { const ids = JSON.parse(body).postIds; items = ids.map((id, index) => ({ id, slug: post.slug, title: post.title, coverImage: post.coverImage, published: post.published, isActive: true, position: index + 1 })); series.updatedAt = "2026-01-02T00:00:00Z"; return respond(200, { postIds: ids }); }
    if (req.url === `/api/v1/series/${seriesId}` && req.method === "DELETE") { series = null; res.statusCode = 204; return res.end(); }
    if (req.url === `/api/v1/users/${authorId}` && req.method === "GET") return respond(200, { id: authorId, name: "Autora sintética", email: "autora@example.test", role, emailVerified: true, bio: null, firstPostApproved: true });
    if (req.url === "/api/v1/posts" && req.method === "POST" && role === "AUTHOR") {
      const input = JSON.parse(body);
      post = { id: postId, authorId, title: input.title, slug: "titulo-sintetico", content: input.content, published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
      return respond(201, post);
    }
    if (req.url === `/api/v1/posts/${postId}` && req.method === "GET") return respond(200, post);
    if (req.url === `/api/v1/posts/${postId}` && req.method === "PATCH" && post?.reviewStatus !== "PENDING") {
      const input = JSON.parse(body);
      Object.assign(post, input);
      if (input.published === true) post.scheduledAt = null;
      return respond(200, post);
    }
    if (req.url === `/api/v1/posts/${postId}` && ["PATCH", "DELETE"].includes(req.method) && post?.reviewStatus === "PENDING") return respond(409, { message: "Conto em revisao" });
    if (req.url === "/api/v1/posts/me?page=1&limit=10&kind=standalone" && req.method === "GET") return respond(200, { data: post?.isActive ? [post] : [], meta: { page: 1, hasNextPage: false, hasPreviousPage: false } });
    if (req.url === `/api/v1/posts/${postId}` && req.method === "DELETE" && role === "AUTHOR") { post.isActive = false; post.published = false; post.scheduledAt = null; res.statusCode = 204; return res.end(); }
    if (req.url === `/api/v1/post-reviews/${postId}/submit` && req.method === "POST" && role === "AUTHOR" && post?.reviewStatus === "DRAFT") { post.reviewStatus = "PENDING"; return respond(201, { status: "PENDING" }); }
    if (req.url === "/api/v1/post-reviews" && req.method === "GET") return role !== "ADMIN" ? respond(403, {}) : respond(200, post?.reviewStatus === "PENDING" ? [post] : []);
    if (req.url === `/api/v1/post-reviews/${postId}/decision` && req.method === "POST" && role === "ADMIN" && post?.reviewStatus === "PENDING") { post.reviewStatus = JSON.parse(body).decision; post.published = post.reviewStatus === "APPROVED"; return respond(201, { status: post.reviewStatus }); }
    return respond(404, {});
  });
  api.listen(0, "127.0.0.1"); await once(api, "listening");
  const freePort = async () => { const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; };
  const port = await freePort(), debugPort = await freePort(), base = `http://localhost:${port}`;
  let app, browser, socket;
  t.after(async () => {
    socket?.close();
    await Promise.all([app, browser].filter(Boolean).map(child => new Promise(resolve => {
      if (!child.pid) return resolve();
      if (process.platform === "win32") execFile("taskkill", ["/pid", String(child.pid), "/t", "/f"], () => resolve());
      else { child.kill(); resolve(); }
    })));
    await new Promise(resolve => api.close(resolve));
    // Never recurse through the dependency junction. Fail closed if its target or
    // the temporary directory is not exactly what this test created.
    const link = join(temp, "node_modules");
    const tempRoot = await realpath(tmpdir());
    const tempReal = await realpath(temp);
    assert.equal(dirname(tempReal).toLowerCase(), tempRoot.toLowerCase());
    assert.match(basename(tempReal), /^blog-series-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependências temporárias não são junção");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  app = spawn(process.execPath, [join(temp, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(port)], {
    cwd: temp, env: { ...process.env, API_ORIGIN: `http://127.0.0.1:${api.address().port}`, SITE_ORIGIN: base, EDITORIAL_WORKFLOW_ENABLED: "true", ENABLE_ADMIN_BFF: "true" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let appOutput = "", startupError;
  app.on("error", error => { startupError = error; });
  const capture = chunk => { if (appOutput.length < 6000) appOutput += chunk; }; app.stdout.on("data", capture); app.stderr.on("data", capture);
  const executable = process.env.CHROME_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  browser = spawn(executable, ["--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(temp, "browser")}`, "about:blank"], { stdio: "ignore" });
  browser.on("error", error => { startupError = error; });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { if (startupError) throw startupError; try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/studio/novo`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === "page" && item.url === "about:blank"), "Chromium; defina CHROME_PATH");
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let sequence = 0; const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from((document.querySelector('dialog[open]') || document).querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);

  const viewport = async width => { await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 700 }); await delay(150); };
  const assertFits = async label => {
    const dimensions = await evaluate("({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth })");
    assert.ok(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1, `${label}: conteúdo ultrapassa a largura da tela: ${JSON.stringify(dimensions)}`);
    const clipped = await evaluate("Array.from(document.querySelectorAll('main h1, main h2, main h3, main textarea')).filter(e => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 2).map(e => ({tag:e.tagName, text:e.textContent?.slice(0,80), width:e.clientWidth, scroll:e.scrollWidth}))");
    assert.deepEqual(clipped, [], `${label}: título ou campo cortado horizontalmente`);
  };
  const screenshot = async name => {
    if (!process.env.SERIES_BROWSER_SCREENSHOTS) return;
    const directory = resolve(process.env.SERIES_BROWSER_SCREENSHOTS);
    await mkdir(directory, { recursive: true });
    await evaluate("scrollTo(0,0)");
    const { cssContentSize } = await cdp("Page.getLayoutMetrics");
    const result = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 6000), scale: 1 } });
    await writeFile(join(directory, `${name}.png`), Buffer.from(result.data, "base64"));
  };

  await cdp("Page.navigate", { url: base });
  await waitFor(() => has(seriesTitle), "home com uma publicação sintética");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('main img')).every(e => e.complete && e.naturalWidth > 0)"), "capas da home carregadas");
  for (const width of [1440, 768, 390, 360]) {
    await viewport(width);
    await assertFits(`home ${width}px`);
    const home = await evaluate("(()=>{ const section=document.querySelector('#contos');const article=section.querySelector('article');return {section:section.clientWidth,article:article.getBoundingClientRect().width,count:section.querySelectorAll('article').length};})()");
    assert.equal(home.count, 1, "fixture pública tem exatamente uma publicação");
    assert.ok(home.article >= home.section * 0.95, `publicação única deve ocupar a seção de leituras: ${JSON.stringify(home)}`);
    await evaluate("document.querySelector('#contos').scrollIntoView()");
    if (process.env.SERIES_BROWSER_SCREENSHOTS) {
      const result = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const directory = resolve(process.env.SERIES_BROWSER_SCREENSHOTS); await mkdir(directory, { recursive: true });
      await writeFile(join(directory, `home-${width}.png`), Buffer.from(result.data, "base64"));
    }
  }
  await viewport(1440);


  await cdp("Page.navigate", { url: `${base}/entrar` });
  await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hidratado");
  await fill("#email", "autora@example.test"); await fill("#password", "AUTHOR"); await click("Entrar");
  await waitFor(() => evaluate("location.pathname === '/conta'"), "entrada");
  await cdp("Page.navigate", { url: `${base}/studio/series` });
  await waitFor(() => has("Nova s\u00e9rie"), "gestao de series");
  await click("Nova s\u00e9rie");
  await waitFor(() => has("Criar nova s\u00e9rie"), "tela de criacao");
  await fill("form input", seriesTitle);
  await fill("form textarea", description);
  assert.equal(await evaluate("(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()"), true);
  await evaluate("document.querySelector('main a[href=\"/studio\"]').click()");
  await waitFor(() => has("Sair sem salvar?"), "confirmacao de saida"); await click("Cancelar");
  assert.equal(await evaluate("document.querySelector('form input').value"), seriesTitle);
  await click("Criar s\u00e9rie"); await waitFor(() => has("S\u00e9rie criada!"), "criacao");
  const backLinks = await evaluate("Array.from(document.querySelectorAll('main a,main button')).filter(e=>e.textContent.trim()==='Voltar para minhas séries').length");
  assert.equal(backLinks, 1, "série aberta oferece uma única ação para voltar à lista");
  assert.equal(await evaluate("!!document.querySelector('main a[href=\"/conta\"]')"), false, "volta contextual ocupa o lugar de Minha conta no detalhe");
  await click("Ler descri\u00e7\u00e3o completa"); await waitFor(() => has("Recolher descri\u00e7\u00e3o"), "descrição expandida");
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('main p')).some(e=>e.textContent===${JSON.stringify(description)})`), true, "descrição expandida mostra todo o texto");
  await click("Recolher descri\u00e7\u00e3o");
  for (const [key, tab] of [["ArrowRight", "add"], ["End", "settings"], ["ArrowLeft", "add"], ["Home", "chapters"]]) {
    const focus = await evaluate("(()=>{const e=document.querySelector('[role=tab][aria-selected=true]');e.focus();return {expected:e.id,active:document.activeElement.outerHTML,focused:document.activeElement===e,dialog:document.querySelector('dialog[open]')?.outerHTML};})()");
    assert.ok(focus.focused, `aba deve receber foco: ${JSON.stringify(focus)}`);
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35 }[key] });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
    await waitFor(() => evaluate(`document.activeElement.id==='series-tab-${tab}' && document.activeElement.getAttribute('aria-selected')==='true'`), `aba ${tab} via ${key}`).catch(async error => {
      const state = await evaluate("({focused:document.activeElement.outerHTML,dialog:document.querySelector('dialog[open]')?.outerHTML,tabs:Array.from(document.querySelectorAll('[role=tab]')).map(e=>({id:e.id,selected:e.getAttribute('aria-selected')}))})");
      await screenshot("tab-failure");
      throw new Error(`${error.message}: ${JSON.stringify(state)}`);
    });
    assert.equal(await evaluate(`document.querySelector('[role=tabpanel]').getAttribute('aria-labelledby')`), `series-tab-${tab}`, "painel mantém associação com a aba ativa");
  }
  await click("Adicionar contos"); await waitFor(() => has("Adicionar contos \u00e0 s\u00e9rie"), "aba adicionar");
  await click("Adicionar"); await click("Salvar ordem e contos");
  await waitFor(() => has("Salvar contos e ordem?"), "confirmacao de ordem");
  assert.equal(items.length, 0); await click("Salvar ordem");
  await waitFor(() => has("Ordem dos contos salva com sucesso."), "ordem salva"); assert.equal(items[0].id, postId);
  await click("Cap\u00edtulos (1)"); await waitFor(() => has("Remover"), "aba capitulos");
  for (const width of [1440, 768, 390, 360]) {
    await viewport(width);
    await assertFits(`capítulos ${width}px`);
    assert.equal(await evaluate(`document.querySelector('[role=tabpanel] h3').textContent`), chapterTitle);
    await click("Ler descri\u00e7\u00e3o completa");
    await assertFits(`descrição expandida ${width}px`);
    await click("Recolher descri\u00e7\u00e3o");
    await screenshot(`series-chapters-${width}`);
    await click("Configura\u00e7\u00f5es"); await waitFor(() => evaluate("!!document.querySelector('#edit-series-desc')"), "configurações");
    await assertFits(`configurações ${width}px`);
    const editor = await evaluate("(()=>{const e=document.querySelector('#edit-series-desc');return {value:e.value,height:e.clientHeight,width:e.clientWidth,lineHeight:parseFloat(getComputedStyle(e).lineHeight)}})()");
    assert.equal(editor.value, description, "editor preserva a descrição completa");
    if (width >= 768) assert.ok(editor.height >= editor.lineHeight * 10, `editor desktop deve exibir pelo menos dez linhas: ${JSON.stringify(editor)}`);
    await screenshot(`series-settings-${width}`);
    await click("Cap\u00edtulos (1)"); await waitFor(() => has("Remover"), "retorno aos capítulos");
  }
  await viewport(1440);
  await click("Remover");
  await evaluate("document.querySelector('main a[href=\"/studio\"]').click()");
  await waitFor(() => has("Sair sem salvar?"), "confirmacao ao remover"); await click("Cancelar");
  assert.equal(items.length, 1);
  await click("Descartar altera\u00e7\u00f5es");
  assert.equal(await evaluate("(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()"), false);
  await click("Configura\u00e7\u00f5es"); await waitFor(() => has("Excluir s\u00e9rie"), "aba configuracoes");
  await click("Excluir s\u00e9rie"); await waitFor(() => has("Excluir s\u00e9rie?"), "confirmacao de exclusao");
  await evaluate("document.querySelector('dialog[open] button:last-child').click()");
  await waitFor(() => has("S\u00e9rie exclu\u00edda."), "exclusao"); assert.equal(series, null); assert.equal(post.isActive, true);
});
