import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { cp, lstat, mkdtemp, readlink, realpath, rm, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

// Execute: node --test tests/editorial-e2e.test.mjs
// Requires Node 22+ and a Chromium executable in CHROME_PATH (defaults to Edge on Windows).
// A temporary project and API are used; no requests reach the configured backend.
test("autor escreve e envia; administrador revisa na API simulada", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-editorial-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const authorId = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const token = (role) => `test.${Buffer.from(JSON.stringify({ sub: authorId, role })).toString("base64url")}.test`;
  let post, reportDecision, reportModerator = null;
  let category = { id: postId, name: "Categoria sintética", slug: "categoria-sintetica", description: "Descrição", isActive: true };
  const api = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method === "POST" && req.url === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (["AUTHOR", "ADMIN"].includes(role)) res.setHeader("Set-Cookie", "refreshToken=synthetic; HttpOnly; Path=/api/v1/auth; SameSite=Strict");
      return ["AUTHOR", "ADMIN"].includes(role) ? respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    }
    if (req.method === "POST" && req.url === "/api/v1/auth/refresh") return req.headers.cookie?.includes("refreshToken=synthetic") ? respond(200, { access_token: token("AUTHOR"), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    if (req.method === "GET" && req.url === "/api/v1/categories?page=1&limit=20") return respond(200, { data: category ? [category] : [], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } });
    if (req.method === "GET" && req.url === `/api/v1/categories/${postId}`) return category ? respond(200, category) : respond(404, {});
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const role = bearer === token("AUTHOR") ? "AUTHOR" : bearer === token("ADMIN") ? "ADMIN" : "";
    if (!role) return respond(401, {});
    if (role === "ADMIN" && req.url === "/api/v1/categories" && req.method === "POST") { const value = JSON.parse(body); category = { id: postId, ...value, slug: "nova-categoria", isActive: true }; return respond(201, category); }
    if (role === "ADMIN" && req.url === `/api/v1/categories/${postId}` && req.method === "PATCH") { category = { ...category, ...JSON.parse(body) }; return respond(200, category); }
    if (role === "ADMIN" && req.url === `/api/v1/categories/${postId}` && req.method === "DELETE") { category = null; res.statusCode = 204; return res.end(); }
    if (req.url === "/api/v1/admin/analytics/overview" && req.method === "GET") return role === "ADMIN" ? respond(200, { users: { total: 1, active: 1, verified: 1 }, posts: { total: 1, published: 1, drafts: 0 }, comments: { total: 0, active: 0 }, reports: { total: 0, pending: 0 }, generatedAt: "2026-01-01T12:00:00Z" }) : respond(403, {});
    if (req.url === "/api/v1/admin/categories?page=1&limit=20" && req.method === "GET") return role === "ADMIN" ? respond(200, { data: category ? [{ ...category, deletedAt: null, postCount: 0 }] : [], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }) : respond(403, {});
    if (req.url === "/api/v1/reports?status=PENDING&page=1&limit=20" && req.method === "GET") return role === "ADMIN" ? respond(200, { data: reportDecision ? [] : [{ id: postId, postId, commentId: null, reason: "Motivo sintético", status: "PENDING" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }) : respond(403, {});
    if (req.url === `/api/v1/reports/${postId}` && req.method === "GET") return respond(200, { id: postId, reason: "Motivo sintético", reasonCategory: null, description: null, status: reportDecision ? "RESOLVED" : reportModerator ? "IN_REVIEW" : "PENDING", moderatorId: reportModerator, moderator: reportModerator ? { id: reportModerator, name: "Autora sintética", role: "ADMIN" } : null, moderationNote: reportDecision?.note ?? null, createdAt: "2026-01-01T12:00:00.000Z", target: { type: "POST", id: postId, title: "Título sintético", content: "Conteúdo sintético" } });
    if (req.url === `/api/v1/reports/${postId}/history?page=1&limit=10` && req.method === "GET") return respond(200, { data: [], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } });
    if (req.url === `/api/v1/reports/${postId}/assign` && req.method === "PATCH" && role === "ADMIN") { reportModerator = authorId; return respond(200, { id: postId, status: "IN_REVIEW", moderatorId: authorId }); }
    if (req.url === `/api/v1/reports/${postId}/resolve` && req.method === "POST" && role === "ADMIN") { reportDecision = JSON.parse(body); return respond(201, { id: postId, status: reportDecision.status }); }
    if (req.url === `/api/v1/reports/${postId}` && req.method === "PATCH") { if (role !== "ADMIN") return respond(403, {}); reportDecision = JSON.parse(body); return respond(200, { id: postId, ...reportDecision }); }
    if (req.url === `/api/v1/users/${authorId}` && req.method === "GET") return respond(200, { id: authorId, name: "Autora sintética", email: "autora@example.test", role, emailVerified: true, bio: null, firstPostApproved: false });
    if (req.url === "/api/v1/posts" && req.method === "POST" && role === "AUTHOR") {
      const input = JSON.parse(body);
      post = { id: postId, authorId, title: input.title, slug: "titulo-sintetico", content: input.content, published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
      return respond(201, post);
    }
    if (req.url === `/api/v1/posts/${postId}` && req.method === "GET") return respond(200, post);
    if (req.url === `/api/v1/posts/${postId}` && ["PATCH", "DELETE"].includes(req.method) && post?.reviewStatus === "PENDING") return respond(409, { message: "Artigo em revisao" });
    if (req.url === "/api/v1/posts/me?page=1&limit=10" && req.method === "GET") return respond(200, { data: post?.isActive ? [post] : [], meta: { page: 1, hasNextPage: false, hasPreviousPage: false } });
    if (req.url === `/api/v1/posts/${postId}` && req.method === "DELETE" && role === "AUTHOR") { post.isActive = false; post.published = false; post.scheduledAt = null; res.statusCode = 204; return res.end(); }
    if (req.url === `/api/v1/post-reviews/${postId}/submit` && req.method === "POST" && role === "AUTHOR" && post?.reviewStatus === "DRAFT") { post.reviewStatus = "PENDING"; return respond(201, { status: "PENDING" }); }
    if (req.url === "/api/v1/post-reviews" && req.method === "GET") return role !== "ADMIN" ? respond(403, {}) : respond(200, post?.reviewStatus === "PENDING" ? [post] : []);
    if (req.url === `/api/v1/post-reviews/${postId}/decision` && req.method === "POST" && role === "ADMIN" && post?.reviewStatus === "PENDING") { post.reviewStatus = JSON.parse(body).decision; post.published = post.reviewStatus === "APPROVED"; return respond(201, { status: post.reviewStatus }); }
    return respond(404, {});
  });
  api.listen(0, "127.0.0.1"); await once(api, "listening");
  const freePort = async () => { const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; };
  const port = await freePort(), debugPort = await freePort(), base = `http://localhost:${port}`;
  const app = spawn(process.execPath, [join(temp, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(port)], {
    cwd: temp, env: { ...process.env, API_ORIGIN: `http://127.0.0.1:${api.address().port}`, SITE_ORIGIN: base, EDITORIAL_WORKFLOW_ENABLED: "true", ENABLE_ADMIN_BFF: "true" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let appOutput = ""; const capture = chunk => { if (appOutput.length < 6000) appOutput += chunk; }; app.stdout.on("data", capture); app.stderr.on("data", capture);
  const executable = process.env.CHROME_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(temp, "browser")}`, "about:blank"], { stdio: "ignore" });
  browser.on("error", () => {});
  let socket;
  t.after(async () => {
    socket?.close();
    await Promise.all([app, browser].map(child => new Promise(resolve => {
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
    assert.match(basename(tempReal), /^blog-editorial-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependências temporárias não são junção");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/studio/novo`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === "page" && item.url === "about:blank"), "Chromium; defina CHROME_PATH");
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let sequence = 0; const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp("Page.navigate", { url: `${base}/studio/novo` });
  await waitFor(() => has("Entre para acessar o editor"), "editor sem sessão");
  await cdp("Page.navigate", { url: `${base}/entrar` }); await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hidratado");
  await fill("#email", "autora@example.test"); await fill("#password", "AUTHOR"); await click("Entrar");
  await waitFor(() => evaluate("location.pathname === '/conta'"), "entrada");
  await cdp("Page.navigate", { url: `${base}/studio/novo` }); await waitFor(() => has("Seu artigo permanece privado"), "editor autenticado");
  await fill("#article-title", "Título sintético"); await fill("#article-content", "Conteúdo sintético para revisão."); await click("Salvar rascunho"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirm save"); await click("Confirmar e salvar");
  await waitFor(() => has("Rascunho salvo."), "salvamento"); assert.equal(post.reviewStatus, "DRAFT");
  post.scheduledAt = "2099-01-01T12:00:00.000Z";
  await cdp("Page.navigate", { url: `${base}/studio/${postId}` });
  await waitFor(() => has("Publicação agendada para"), "agendamento exibido");
  assert.equal(await has("Artigos agendados não podem ser enviados para revisão"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Enviar para revisão')"), false);
  post.scheduledAt = null;
  await cdp("Page.navigate", { url: `${base}/studio/${postId}` });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Enviar para revis\u00e3o')"), "rascunho sem agendamento");
  await click("Enviar para revisão");
  await fill("#article-content", "Conteúdo sintético modificado.");
  assert.equal(await has("Confirmar envio"), false);
  await evaluate("Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Voltar ao Studio')).click()");
  await waitFor(() => has("Sair sem salvar?"), "confirmação de saída"); await click("Cancelar");
  assert.equal(await evaluate("location.pathname"), `/studio/${postId}`);
  assert.equal(await evaluate("document.querySelector('#article-content').value"), "Conteúdo sintético modificado.");
  await fill("#article-content", "Conteúdo sintético para revisão.");
  await click("Enviar para revisão"); await click("Confirmar envio"); await waitFor(() => has("Artigo enviado para revisão."), "envio");
  assert.equal(post.reviewStatus, "PENDING"); assert.equal(await evaluate("document.querySelector('#article-content').readOnly"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('input,textarea')).every(field => field.readOnly || field.disabled)"), true);
  const deniedEdit = await fetch(`http://127.0.0.1:${api.address().port}/api/v1/posts/${postId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token("AUTHOR")}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Mudanca indevida" }) });
  const deniedDelete = await fetch(`http://127.0.0.1:${api.address().port}/api/v1/posts/${postId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token("AUTHOR")}` } });
  assert.equal(deniedEdit.status, 409); assert.equal(deniedDelete.status, 409); assert.equal(post.isActive, true);
  await cdp("Page.navigate", { url: `${base}/studio` });
  await waitFor(() => has("Em revis\u00e3o"), "listagem de artigo pendente");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('a')).some(x => x.textContent.trim() === 'Editar artigo')"), false);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Desativar')?.disabled"), true);
  assert.equal(await evaluate("!!document.querySelector('dialog[open]')"), false);


  const request = (path, init = {}) => fetch(`${base}${path}`, { redirect: "manual", ...init });
  let response = await request("/gestao-editorial"); assert.equal(response.status, 307);
  response = await request("/gestao-editorial/entrar");
  const csrf = (await response.text()).match(/name="csrf" value="([^"]+)"/)[1];
  const loginCookie = response.headers.getSetCookie().find(c => c.startsWith("editorial-login-dev=")).split(";")[0];
  const form = (path, values, cookie) => request(path, { method: "POST", headers: { Origin: base, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values) });
  response = await form("/gestao-editorial/entrar/sessao", { csrf, email: "admin@example.test", password: "ADMIN" }, loginCookie); assert.equal(response.status, 303);
  const session = response.headers.getSetCookie().find(c => c.startsWith("editorial-session-dev=")).split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: session } }); const html = await response.text(); assert.match(html, /O Grifório em números/);
  const decisionCsrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  response = await form(`/gestao-editorial/artigos/${postId}/revisar`, { csrf: decisionCsrf, decision: "APPROVED", reason: "" }, session); assert.equal(response.status, 204);
  assert.equal(post.reviewStatus, "APPROVED"); assert.equal(post.published, true);
  await cdp("Page.navigate", { url: `${base}/gestao-editorial/entrar` });
  await waitFor(() => evaluate("!!document.querySelector('input[name=email]')"), "entrada administrativa");
  await fill("input[name=email]", "admin@example.test"); await fill("input[name=password]", "ADMIN"); await click("Entrar");
  await waitFor(() => evaluate("location.pathname === '/gestao-editorial'"), "entrada administrativa no navegador");
  await waitFor(() => evaluate("Object.keys(document.querySelector('a[href=\"/gestao-editorial/denuncias\"]') || {}).some(key => key.startsWith('__reactProps'))"), "hidratação da navegação");
  await evaluate("window.__adminNavigationMarker = 'preservado'; document.querySelector('a[href=\"/gestao-editorial/denuncias\"]').click()");
  await waitFor(() => evaluate("location.pathname === '/gestao-editorial/denuncias'"), "navegação administrativa");
  assert.equal(await evaluate("window.__adminNavigationMarker"), "preservado");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await cdp("Page.navigate", { url: `${base}/gestao-editorial/categorias` });
  await waitFor(() => has("Categoria sintética"), "categorias administrativas");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "categorias sem rolagem horizontal");
  await waitFor(() => evaluate("Object.keys(document.querySelector('[aria-label=\"Alternar tema de aparência\"]') || {}).some(key => key.startsWith('__reactProps'))"), "hidratação do tema");
  await evaluate("document.querySelector('[aria-label=\"Alternar tema de aparência\"]').click()");
  await waitFor(() => evaluate("['light', 'dark'].includes(document.documentElement.dataset.theme)"), "alternância de tema");
  const firstTheme = await evaluate("document.documentElement.dataset.theme");
  assert.ok(["light", "dark"].includes(firstTheme));
  await evaluate("document.querySelector('[aria-label=\"Alternar tema de aparência\"]').click()");
  assert.notEqual(await evaluate("document.documentElement.dataset.theme"), firstTheme);
  await evaluate("document.querySelector('input[placeholder=\"Ex: Tecnologia\"]').focus()");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.getAttribute('placeholder')"), "Breve resumo sobre a categoria");
  await cdp("Page.navigate", { url: `${base}/gestao-editorial/denuncias` });
  await waitFor(() => has("Motivo sintético"), "fila de denúncias");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "denúncias sem rolagem horizontal");
  await cdp("Page.navigate", { url: `${base}/gestao-editorial/denuncias/${postId}` });
  await waitFor(() => evaluate("Object.keys(Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Assumir análise') || {}).some(key => key.startsWith('__reactProps'))"), "detalhe da denúncia");
  await click("Assumir análise");
  await waitFor(() => has("Atribuída a você"), "atribuição da análise");
  await fill("textarea[required]", "Análise sintética");
  await evaluate("window.confirm = () => true");
  await click("Registrar decisão");
  await waitFor(() => has("Decisão registrada com sucesso.") || has("Resolvida (Procedente)"), "decisão de moderação");
  assert.deepEqual(reportDecision, { status: "RESOLVED", action: "NONE", note: "Análise sintética" });
  await cdp("Emulation.clearDeviceMetricsOverride");
  await cdp("Page.navigate", { url: `${base}/studio` });
  await waitFor(() => has("Título sintético"), "listagem do autor");
  await click("Desativar"); await waitFor(() => has("Desativar artigo?"), "confirmação de desativação"); await click("Cancelar"); assert.equal(post.isActive, true);
  await click("Desativar"); await click("Desativar artigo");
  await waitFor(() => has("Artigo desativado com sucesso."), "desativação confirmada");
  assert.equal(post.isActive, false); assert.equal(post.published, false);
  assert.equal(await has("Título sintético"), false);
});
