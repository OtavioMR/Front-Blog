import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { cp, lstat, mkdtemp, readlink, realpath, rm, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

// Execute: node --test tests/comment-browser.test.mjs
// Requires Node 22+ and a Chromium executable in CHROME_PATH (defaults to Edge on Windows).
// A temporary project and API are used; no requests reach the configured backend.
test("collections create rename add remove and delete", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-collections-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615", postId = "76f781e0-9f94-42a3-ac2a-8dc5a41a983d", collectionId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const token = `test.${Buffer.from(JSON.stringify({ sub: id, role: "READER" })).toString("base64url")}.test`;
  let collection = null, included = false;
  const api = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk; const url = new URL(req.url, "http://localhost");
    const respond = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (url.pathname === "/api/v1/auth/login") { res.setHeader("Set-Cookie", "refreshToken=synthetic; HttpOnly; Path=/api/v1/auth; SameSite=Strict"); return respond(201, { access_token: token, token_type: "Bearer", expires_in: 900 }); }
    if (url.pathname === "/api/v1/auth/refresh") return req.headers.cookie?.includes("refreshToken=synthetic") ? respond(200, { access_token: token, token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    if (req.headers.authorization !== `Bearer ${token}`) return respond(401, {});
    if (url.pathname === `/api/v1/users/${id}`) return respond(200, { id, role: "READER", name: "Pessoa", email: "pessoa@example.test", emailVerified: true, bio: null });
    if (url.pathname === "/api/v1/posts/saved") return respond(200, { data: [{ id: postId, title: "Artigo sintetico", excerpt: "Resumo", published: true, isActive: true, author: { name: "Autor" } }], meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } });
    if (url.pathname === "/api/v1/collections") { if (req.method === "POST") { collection = { id: collectionId, name: JSON.parse(body).name, createdAt: "2026-01-01T00:00:00Z" }; return respond(201, collection); } return respond(200, collection ? [collection] : []); }
    if (url.pathname === `/api/v1/collections/${collectionId}`) { if (req.method === "PATCH") { collection.name = JSON.parse(body).name; return respond(200, collection); } if (req.method === "DELETE") { collection = null; res.writeHead(204); return res.end(); } }
    if (url.pathname === `/api/v1/collections/${collectionId}/posts`) return respond(200, { data: included ? [{ id: postId, slug: "artigo-sintetico", title: "Artigo sintetico", excerpt: "Resumo" }] : [], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } });
    if (url.pathname === `/api/v1/collections/${collectionId}/posts/${postId}`) { included = req.method === "PUT"; res.writeHead(204); return res.end(); }
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
  let socket, secondSocket;
  t.after(async () => {
    socket?.close(); secondSocket?.close();
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
    assert.match(basename(tempReal), /^blog-collections-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependÃªncias temporÃ¡rias nÃ£o sÃ£o junÃ§Ã£o");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/conta/salvos`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
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
  await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login");
  await fill("#email", "pessoa@example.test"); await fill("#password", "fixture"); await click("Entrar"); await waitFor(() => evaluate("location.pathname === '/conta'"), "login done");
  await cdp("Page.navigate", { url: `${base}/conta/salvos` }); await waitFor(() => evaluate("!!document.querySelector('#collection-name')"), "collections");
  await fill("#collection-name", "Lista sintetica"); await click("Criar cole\u00e7\u00e3o"); await waitFor(() => has("Cole\u00e7\u00e3o criada."), "create");
  const select = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await select("#collection-select", collectionId); await waitFor(() => has("Artigos da cole\u00e7\u00e3o"), "select");
  await fill("#collection-name", "Lista renomeada"); await click("Renomear"); await waitFor(() => has("Cole\u00e7\u00e3o renomeada."), "rename"); assert.equal(collection.name, "Lista renomeada");
  await select("#saved-select", postId); await click("Adicionar"); await waitFor(() => has("Artigo adicionado"), "add"); assert.equal(included, true);
  await click("Remover"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "remove confirmation"); await click("Cancelar"); assert.equal(included, true);
  await click("Remover"); await click("Remover artigo"); await waitFor(() => has("Artigo removido"), "remove"); assert.equal(included, false);
  await click("Excluir cole\u00e7\u00e3o"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "delete confirmation"); await evaluate("document.querySelector('dialog button:last-child').click()"); await waitFor(() => has("Cole\u00e7\u00e3o exclu\u00edda"), "delete"); assert.equal(collection, null);
});
