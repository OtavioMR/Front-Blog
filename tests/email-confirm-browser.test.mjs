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
test("confirma??o de cadastro e troca de e-mail usam endpoints corretos", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-email-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const requests = [];
  const api = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    if (req.method === "POST" && ["/api/v1/users/confirm-email", "/api/v1/users/confirm-email-change"].includes(req.url)) {
      requests.push({ path: req.url, body: JSON.parse(body) });
      const expired = JSON.parse(body).token === "b".repeat(64);
      res.writeHead(expired ? 400 : 200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ message: expired ? "Token inválido ou expirado." : "ok" })); return;
    }
    res.writeHead(404); res.end();
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
    assert.match(basename(tempReal), /^blog-email-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependÃªncias temporÃ¡rias nÃ£o sÃ£o junÃ§Ã£o");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/confirmar-email`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === "page" && item.url === "about:blank"), "Chromium; defina CHROME_PATH");
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let sequence = 0; const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const token = "a".repeat(64);
  await cdp("Page.navigate", { url: `${base}/confirmar-email?type=email-change` });
  await waitFor(() => has("Confirme seu novo e-mail."), "tipo de troca");
  await waitFor(() => evaluate("!!document.querySelector('input') && Object.keys(document.querySelector('input')).some(k => k.startsWith('__reactProps'))"), "hidrata??o");
  await fill("input", token); await click("Confirmar e-mail");
  await waitFor(() => has("Novo e-mail confirmado."), "confirma??o de troca");
  assert.deepEqual(requests[0], { path: "/api/v1/users/confirm-email-change", body: { token } });

  await cdp("Page.navigate", { url: `${base}/confirmar-email?type=email-change&token=${token}` });
  await waitFor(() => evaluate(`!location.search.includes('token=') && document.querySelector('input')?.value === ${JSON.stringify(token)}`), "remocao do token de troca");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('type')"), "email-change");
  await cdp("Page.reload");
  await waitFor(() => has("Confirme seu novo e-mail."), "tipo preservado apos recarga");

  await cdp("Page.navigate", { url: "about:blank" });
  await cdp("Page.navigate", { url: `${base}/confirmar-email` });
  await waitFor(() => evaluate("!!document.querySelector('input[name=confirmationCode]')"), "formulario de codigo");
  await waitFor(() => evaluate("Object.keys(document.querySelector('input[name=confirmationCode]')).some(k => k.startsWith('__reactProps'))"), "hidratacao");
  await fill('input[type=email]', 'reader@example.test');
  await fill('input[name=confirmationCode]', '012345');
  assert.equal(requests.length, 1, "abrir a pagina nao confirma");
  await click("Confirmar e-mail");
  await waitFor(() => has("E-mail confirmado com sucesso."), "confirmacao por codigo");
  assert.deepEqual(requests[1], { path: "/api/v1/users/confirm-email", body: { token: '012345', email: 'reader@example.test' } });
  const response = await fetch(`${base}/confirmar-email`);
  assert.match(response.headers.get("referrer-policy"), /no-referrer/);
  assert.match(response.headers.get("cache-control"), /no-store/);

});
