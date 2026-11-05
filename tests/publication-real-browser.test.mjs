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

// Execute with the isolated Sprint 0 services and backend: set BLOG_REAL_E2E=1, then node --test tests/publication-real-browser.test.mjs.
// Creates uniquely named synthetic users and posts in the isolated test database.
// Requires Node 22+ and a Chromium executable in CHROME_PATH (defaults to Edge on Windows).
// The frontend is temporary; the API must be the isolated copy on localhost:3001.
test("publicacao e revisao no navegador com API isolada", { timeout: 120000, skip: process.env.BLOG_REAL_E2E !== "1" }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-publication-e2e-"));
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
  const author = await user("Author"), first = await user("First");
  const draft = await request("/api/v1/posts", "POST", { title: `Publicacao sintetica ${suffix}`, content: "Conteudo sintetico.", published: false }, author.token);
  const firstDraft = await request("/api/v1/posts", "POST", { title: `Primeiro artigo sintetico ${suffix}`, content: "Conteudo sintetico.", published: false }, first.token);
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
    assert.match(basename(tempReal), /^blog-publication-e2e-/);
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
  const enter = async (account, id) => {
    await cdp("Page.navigate", { url: `${base}/entrar` });
    await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hidratado");
    await fill("#email", account.email); await fill("#password", password); await click("Entrar");
    await waitFor(() => evaluate("location.pathname === '/conta'"), "entrada");
    await cdp("Page.navigate", { url: `${base}/studio/${id}` });
  };
  const getDraft = () => request(`/api/v1/posts/${draft.id}`, "GET", undefined, author.token);
  await enter(author, draft.id);
  await waitFor(() => has("Publicar agora"), "controles de publicacao");
  const revisedTitle = `Titulo editado ${suffix}`;
  await fill("input[required]", revisedTitle); await click("Salvar rascunho");
  await waitFor(() => has("Rascunho salvo."), "salvamento de artigo existente");
  assert.equal((await getDraft()).title, revisedTitle);
  await click("Publicar agora"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirmacao de publicacao"); await click("Publicar");
  await waitFor(() => has("Artigo publicado."), "publicacao"); assert.equal((await getDraft()).published, true);
  assert.equal((await fetch(`${base}/posts/${draft.slug}`)).status, 200);
  await click("Retirar do ar"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirmacao de retirada");
  await evaluate("document.querySelector('dialog[open] button:last-child').click()");
  await waitFor(() => has("Artigo retirado do ar e mantido como rascunho."), "retirada");
  assert.equal((await getDraft()).published, false); assert.equal((await fetch(`${base}/posts/${draft.slug}`)).status, 404);
  await fill("#schedule-date", "2099-01-15T12:30"); await click("Agendar publica\u00e7\u00e3o");
  await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirmacao de agenda"); await click("Confirmar agendamento");
  await waitFor(() => has("Publica\u00e7\u00e3o agendada."), "agendamento"); assert.ok((await getDraft()).scheduledAt);
  await click("Cancelar agendamento"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirmacao de cancelamento");
  await evaluate("document.querySelector('dialog[open] button:last-child').click()");
  await waitFor(() => has("Agendamento cancelado."), "cancelamento"); assert.equal((await getDraft()).scheduledAt, null);
  await enter(first, firstDraft.id);
  await waitFor(() => has("Enviar para revis\u00e3o"), "primeiro artigo");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Publicar agora')"), false);
  await click("Enviar para revis\u00e3o"); await click("Confirmar envio"); await waitFor(() => has("Artigo enviado para revis\u00e3o."), "envio para revisao");
  assert.equal(await evaluate("document.querySelector('textarea').readOnly"), true);
  const edit = await fetch(`${origin}/api/v1/posts/${firstDraft.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${first.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Alteracao indevida" }) }); assert.equal(edit.status, 409);
  const remove = await fetch(`${origin}/api/v1/posts/${firstDraft.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${first.token}` } }); assert.equal(remove.status, 409);
  await cdp("Page.navigate", { url: `${base}/studio` }); await waitFor(() => has("Em revis\u00e3o"), "studio pendente");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('a')).some(x => x.textContent.trim() === 'Editar artigo')"), false);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Desativar')?.disabled"), true);
});
