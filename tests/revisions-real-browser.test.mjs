import assert from "node:assert/strict";
import { spawn, execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { cp, lstat, mkdtemp, readlink, realpath, rm, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

// Execute with the isolated Sprint 0 services and backend: set BLOG_REAL_E2E=1, then node --test tests/revisions-real-browser.test.mjs.
// Creates uniquely named synthetic users and posts in the isolated test database.
// Requires Node 22+ and a Chromium executable in CHROME_PATH (defaults to Edge on Windows).
// The frontend is temporary; the API must be the isolated copy on localhost:3001.
test("historico e restauracao no navegador com API isolada", { timeout: 120000, skip: process.env.BLOG_REAL_E2E !== "1" }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-revisions-real-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const origin = "http://127.0.0.1:3001";
  const suffix = randomUUID(); const password = "SyntheticPass123!";
  async function request(path, method = "GET", body, token) {
    const res = await fetch(origin + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text(); if (!res.ok) throw new Error(`${method} ${path} retornou ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  async function user(name) {
    const email = `${name}-${suffix}@example.test`;
    const account = await request("/api/v1/users", "POST", { name, email, password });
    if (!/^[a-f0-9-]{36}$/.test(account.id)) throw new Error("UUID invalido");
    execFileSync("docker", ["compose", "-f", "compose.sprint0.yml", "exec", "-T", "postgres", "psql", "-U", "sprint0_test", "-d", "sprint0_blog_test", "-c", `UPDATE users SET email_verified = true${["Author", "First"].includes(name) ? `, role = 'AUTHOR', first_post_approved = ${name === "Author"}` : name === "Admin" ? ", role = 'ADMIN', first_post_approved = true" : ""} WHERE id = '${account.id}'`], { stdio: "ignore" });
    const session = await request("/api/v1/auth/login", "POST", { email, password });
    return { email, token: session.access_token };
  }
  const author = await user("Author"), other = await user("First"), reader = await user("Reader"), admin = await user("Admin");
  const originalTitle = `Versao anterior ${suffix}`, originalContent = "Conteudo anterior sintetico";
  const post = await request("/api/v1/posts", "POST", { title: originalTitle, content: originalContent, published: true }, author.token);
  await request(`/api/v1/posts/${post.id}`, "PATCH", { title: `Versao atual ${suffix}`, content: "Conteudo atual sintetico" }, author.token);
  const listPath = `/api/v1/posts/${post.id}/revisions?page=1&limit=10`;
  const status = async (path, token, method = "GET") => (await fetch(origin + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} })).status;
  assert.equal(await status(listPath), 401); assert.equal(await status(listPath, reader.token), 403); assert.equal(await status(listPath, other.token), 403); assert.equal(await status(listPath, admin.token), 200);
  const versions = await request(listPath, "GET", undefined, author.token);
  const version = versions.data.find(item => item.title === originalTitle); assert.ok(version);
  const restorePath = `/api/v1/posts/${post.id}/revisions/${version.id}/restore`;
  assert.equal(await status(restorePath, reader.token, "POST"), 403); assert.equal(await status(restorePath, other.token, "POST"), 403);
  const freePort = async () => { const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; };
  const port = await freePort(), debugPort = await freePort(), base = `http://localhost:${port}`;
  const app = spawn(process.execPath, [join(temp, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(port)], {
    cwd: temp, env: { ...process.env, API_ORIGIN: "http://127.0.0.1:3001", SITE_ORIGIN: base, EDITORIAL_WORKFLOW_ENABLED: "true", ENABLE_ADMIN_BFF: "true" }, stdio: ["ignore", "pipe", "pipe"],
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
    // Never recurse through the dependency junction. Fail closed if its target or
    // the temporary directory is not exactly what this test created.
    const link = join(temp, "node_modules");
    const tempRoot = await realpath(tmpdir());
    const tempReal = await realpath(temp);
    assert.equal(dirname(tempReal).toLowerCase(), tempRoot.toLowerCase());
    assert.match(basename(tempReal), /^blog-revisions-real-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependÃªncias temporÃ¡rias nÃ£o sÃ£o junÃ§Ã£o");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/entrar`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === "page" && item.url === "about:blank"), "Chromium; defina CHROME_PATH");
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let sequence = 0; const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp("Page.navigate", { url: `${base}/entrar` });
  await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login");
  await fill("#email", author.email); await fill("#password", password); await click("Entrar"); await waitFor(() => evaluate("location.pathname === '/conta'"), "entrada");
  await cdp("Page.navigate", { url: `${base}/studio/${post.id}` });
  await waitFor(() => has("Ver hist\u00f3rico"), "editor"); await click("Ver hist\u00f3rico");
  await waitFor(() => has(originalTitle), "historico");
  await evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes(${JSON.stringify(originalTitle)})).click()`);
  await waitFor(() => has(originalContent), "previa");
  await fill("#article-content", "Conteudo nao salvo");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Restaurar esta vers\u00e3o').disabled"), true);
  await fill("#article-content", "Conteudo atual sintetico"); await click("Restaurar esta vers\u00e3o");
  await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirmacao"); await click("Cancelar");
  assert.equal((await request(`/api/v1/posts/${post.id}`, "GET", undefined, author.token)).content, "Conteudo atual sintetico");
  await click("Restaurar esta vers\u00e3o"); await click("Restaurar vers\u00e3o");
  await waitFor(() => has("Vers\u00e3o restaurada."), "restauracao");
  const restored = await request(`/api/v1/posts/${post.id}`, "GET", undefined, author.token);
  assert.equal(restored.title, originalTitle); assert.equal(restored.content, originalContent); assert.equal(restored.published, true);
  const publicPost = await fetch(`${base}/posts/${post.slug}`); assert.equal(publicPost.status, 200); assert.match(await publicPost.text(), /Conteudo anterior sintetico/);
});
