import { v2FixtureResponse } from "./support/v2-response.mjs";
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
test("autor aprovado publica, retira e agenda na API simulada", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-publication-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const authorId = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const token = (role) => `test.${Buffer.from(JSON.stringify({ sub: authorId, role })).toString("base64url")}.test`;
  let post = { id: postId, authorId, title: "Synthetic title", slug: "synthetic-title", content: "Synthetic article content.", published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  const api = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(v2FixtureResponse(data, req, res))); };
    if (req.method === "POST" && req.url === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (role === "AUTHOR") res.setHeader("Set-Cookie", "refreshToken=synthetic; HttpOnly; Path=/api/v1/auth; SameSite=Strict");
      return ["AUTHOR", "ADMIN"].includes(role) ? respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    }
    if (req.method === "POST" && req.url === "/api/v1/auth/refresh/v2") return req.headers.cookie?.includes("refreshToken=synthetic") ? respond(200, { access_token: token("AUTHOR"), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const role = bearer === token("AUTHOR") ? "AUTHOR" : bearer === token("ADMIN") ? "ADMIN" : "";
    if (!role) return respond(401, {});
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
    assert.match(basename(tempReal), /^blog-publication-e2e-/);
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
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);

  await cdp("Page.navigate", { url: `${base}/entrar` });
  await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hidratado");
  await fill("#email", "autora@example.test"); await fill("#password", "AUTHOR"); await click("Entrar");
  await waitFor(() => evaluate("location.pathname === '/conta'"), "entrada");
  await cdp("Page.navigate", { url: `${base}/studio/${postId}` });
  await waitFor(() => has("Publicar agora"), "editor autenticado");
  await fill("#article-title", "Alteracao nao salva");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Publicar agora').disabled"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Agendar publica\u00e7\u00e3o').disabled"), true);
  await fill("#article-title", "Synthetic title");
  await click("Publicar agora"); await waitFor(() => has("Publicar artigo?"), "confirmacao de publicacao");
  assert.equal(post.published, false); await click("Publicar");
  await waitFor(() => has("Artigo publicado."), "publicacao"); assert.equal(post.published, true);
  await click("Retirar do ar"); await waitFor(() => has("Retirar artigo do ar?"), "confirmacao de retirada");
  await evaluate("document.querySelector('dialog[open] button:last-child').click()");
  await waitFor(() => has("Artigo retirado do ar"), "retirada"); assert.equal(post.published, false);
  await fill("#schedule-date", "2099-07-01T12:30"); await click("Agendar publica\u00e7\u00e3o");
  await waitFor(() => has("Agendar publica\u00e7\u00e3o?"), "confirmacao de agendamento");
  assert.equal(post.scheduledAt, null); await click("Confirmar agendamento");
  await waitFor(() => has("Publica\u00e7\u00e3o agendada."), "agendamento");
  assert.equal(post.scheduledAt, new Date("2099-07-01T12:30").toISOString());
  await click("Cancelar agendamento"); await waitFor(() => has("Cancelar agendamento?"), "confirmacao de cancelamento");
  await evaluate("document.querySelector('dialog[open] button:last-child').click()");
  await waitFor(() => has("Agendamento cancelado."), "cancelamento"); assert.equal(post.scheduledAt, null);
  post.reviewStatus = "PENDING";
  await cdp("Page.navigate", { url: `${base}/studio/${postId}` });
  await waitFor(() => has("aguarda revis\u00e3o"), "artigo pendente");
  assert.equal(await evaluate("document.querySelector('#article-title').readOnly"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => ['Publicar agora', 'Agendar publica\u00e7\u00e3o'].includes(x.textContent.trim()))"), false);
});
