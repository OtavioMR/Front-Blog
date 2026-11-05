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
test("account deactivation cancellation switch and success", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-account-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const ids = { READER: "4c781e0d-b963-493c-b2df-0a8fa66c0615", AUTHOR: "76f781e0-9f94-42a3-ac2a-8dc5a41a983d" };
  const token = role => `test.${Buffer.from(JSON.stringify({ sub: ids[role], role })).toString("base64url")}.test`;
  const removed = [];
  const api = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.url === "/api/v1/auth/login") { const role = JSON.parse(body).password; if (!ids[role]) return respond(401, {}); res.setHeader("Set-Cookie", `refreshToken=${role}; HttpOnly; Path=/api/v1/auth; SameSite=Strict`); return respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 }); }
    if (req.url === "/api/v1/auth/refresh") { const role = /refreshToken=(READER|AUTHOR)/.exec(req.headers.cookie || "")?.[1]; return role ? respond(200, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {}); }
    const role = Object.keys(ids).find(value => req.headers.authorization === `Bearer ${token(value)}`);
    if (role && req.url === `/api/v1/users/${ids[role]}`) { if (req.method === "DELETE") { removed.push(ids[role]); res.writeHead(204); return res.end(); } return respond(200, { id: ids[role], role, name: "Pessoa", email: "pessoa@example.test", emailVerified: true, bio: null }); }
    return respond(403, {});
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
    assert.match(basename(tempReal), /^blog-account-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependÃªncias temporÃ¡rias nÃ£o sÃ£o junÃ§Ã£o");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/conta/configuracoes`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === "page" && item.url === "about:blank"), "Chromium; defina CHROME_PATH");
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let sequence = 0; const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const loginFirst = async role => {
    await cdp("Page.navigate", { url: `${base}/entrar` });
    await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hydration");
    await fill("#email", "pessoa@example.test"); await fill("#password", role); await click("Entrar");
    await waitFor(() => evaluate("location.pathname === '/conta'"), "login");
    await cdp("Page.navigate", { url: `${base}/conta/configuracoes` });
    await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Desativar minha conta')"), "settings");
  };
  await loginFirst("READER");
  await evaluate("document.querySelector('a[href=\"/conta/perfil\"]').click()");
  await waitFor(() => evaluate("location.pathname === '/conta/perfil' && !!document.querySelector('[data-back-button]')"), "perfil a partir das configurações");
  await evaluate("document.querySelector('[data-back-button]').click()");
  await waitFor(() => evaluate("location.pathname === '/conta'"), "perfil retorna à conta sem voltar às configurações");
  for (const path of ["configuracoes", "perfil", "foto", "email", "senha", "sessoes", "salvos", "feed", "notificacoes"]) {
    await cdp("Page.navigate", { url: `${base}/conta/${path}` });
    await waitFor(() => evaluate("!!document.querySelector('[data-back-button]')"), `retorno em ${path}`);
    assert.equal(await evaluate("document.querySelector('[data-back-button]').getAttribute('href')"), "/conta");
    await evaluate("document.querySelector('[data-back-button]').click()");
    await waitFor(() => evaluate("location.pathname === '/conta'"), `retorno de ${path} à conta`);
  }
  await cdp("Page.navigate", { url: `${base}/conta/configuracoes` });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Desativar minha conta')"), "configurações após navegação");
  await click("Desativar minha conta"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "dialog");
  await click("Cancelar"); assert.deepEqual(removed, []);
  await click("Desativar minha conta"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "dialog again");
  const secondTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(base + "/entrar")}`, { method: "PUT" })).json();
  secondSocket = new WebSocket(secondTarget.webSocketDebuggerUrl); await once(secondSocket, "open");
  let seq2 = 0; const pending2 = new Map();
  secondSocket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending2.has(data.id)) { const { resolve, reject } = pending2.get(data.id); pending2.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
  const cdp2 = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq2; pending2.set(id, { resolve, reject }); secondSocket.send(JSON.stringify({ id, method, params })); });
  const eval2 = async expression => { const result = await cdp2("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  await waitFor(() => eval2("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "second login");
  for (const [selector, value] of [["#email", "pessoa@example.test"], ["#password", "AUTHOR"]]) await eval2(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await eval2("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Entrar').click()");
  await waitFor(() => eval2("location.pathname === '/conta'"), "switch");
  await waitFor(() => evaluate("!document.querySelector('dialog[open]')"), "dialog dismissed on switch");
  assert.deepEqual(removed, []);
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Desativar minha conta')"), "new subject ready");
  await click("Desativar minha conta"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "new dialog");
  await click("Desativar conta"); await waitFor(() => has("Conta desativada."), "success");
  assert.deepEqual(removed, [ids.AUTHOR]);
});
