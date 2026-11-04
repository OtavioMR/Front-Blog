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
  let post;
  const api = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method === "POST" && req.url === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (role === "AUTHOR") res.setHeader("Set-Cookie", "refreshToken=synthetic; HttpOnly; Path=/api/v1/auth; SameSite=Strict");
      return ["AUTHOR", "ADMIN"].includes(role) ? respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    }
    if (req.method === "POST" && req.url === "/api/v1/auth/refresh") return req.headers.cookie?.includes("refreshToken=synthetic") ? respond(200, { access_token: token("AUTHOR"), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const role = bearer === token("AUTHOR") ? "AUTHOR" : bearer === token("ADMIN") ? "ADMIN" : "";
    if (!role) return respond(401, {});
    if (req.url === `/api/v1/users/${authorId}` && req.method === "GET") return respond(200, { id: authorId, name: "Autora sintética", email: "autora@example.test", role, emailVerified: true, bio: null });
    if (req.url === "/api/v1/posts" && req.method === "POST" && role === "AUTHOR") {
      const input = JSON.parse(body);
      post = { id: postId, authorId, title: input.title, content: input.content, published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
      return respond(201, post);
    }
    if (req.url === `/api/v1/posts/${postId}` && req.method === "GET") return respond(200, post);
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
  await fill("input", "Título sintético"); await fill("textarea", "Conteúdo sintético para revisão."); await click("Salvar rascunho");
  await waitFor(() => has("Rascunho salvo."), "salvamento"); assert.equal(post.reviewStatus, "DRAFT");
  post.scheduledAt = "2099-01-01T12:00:00.000Z";
  await cdp("Page.navigate", { url: `${base}/studio/${postId}` });
  await waitFor(() => has("Publicação agendada para"), "agendamento exibido");
  assert.equal(await has("Artigos agendados não podem ser enviados para revisão"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Enviar para revisão')"), false);
  post.scheduledAt = null;
  await cdp("Page.navigate", { url: `${base}/studio/${postId}` });
  await waitFor(() => has("Seu artigo permanece privado"), "rascunho sem agendamento");
  await click("Enviar para revisão");
  await fill("textarea", "Conteúdo sintético modificado.");
  assert.equal(await has("Confirmar envio"), false);
  await evaluate("window.confirm = () => false");
  await evaluate("Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Voltar ao Studio')).click()");
  assert.equal(await evaluate("location.pathname"), `/studio/${postId}`);
  assert.equal(await evaluate("document.querySelector('textarea').value"), "Conteúdo sintético modificado.");
  await fill("textarea", "Conteúdo sintético para revisão.");
  await click("Enviar para revisão"); await click("Confirmar envio"); await waitFor(() => has("Artigo enviado para revisão."), "envio");
  assert.equal(post.reviewStatus, "PENDING"); assert.equal(await evaluate("document.querySelector('textarea').readOnly"), true);

  const request = (path, init = {}) => fetch(`${base}${path}`, { redirect: "manual", ...init });
  let response = await request("/gestao-editorial"); assert.equal(response.status, 401);
  response = await request("/gestao-editorial/entrar");
  const csrf = (await response.text()).match(/name="csrf" value="([^"]+)"/)[1];
  const loginCookie = response.headers.getSetCookie().find(c => c.startsWith("editorial-login-dev=")).split(";")[0];
  const form = (path, values, cookie) => request(path, { method: "POST", headers: { Origin: base, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values) });
  response = await form("/gestao-editorial/entrar", { csrf, email: "admin@example.test", password: "ADMIN" }, loginCookie); assert.equal(response.status, 303);
  const session = response.headers.getSetCookie().find(c => c.startsWith("editorial-session-dev=")).split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: session } }); const html = await response.text(); assert.match(html, /Título sintético/);
  const decisionCsrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  response = await form("/gestao-editorial", { csrf: decisionCsrf, id: postId, decision: "APPROVED" }, session); assert.equal(response.status, 303);
  assert.equal(post.reviewStatus, "APPROVED"); assert.equal(post.published, true);
  response = await request("/gestao-editorial", { headers: { Cookie: session } }); assert.match(await response.text(), /Nenhum artigo aguardando revisão/);
});
