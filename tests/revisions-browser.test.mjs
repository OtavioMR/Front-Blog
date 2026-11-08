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
test("revision preview restore pending and account switch", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-revisions-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const ids = { AUTHOR: "4c781e0d-b963-493c-b2df-0a8fa66c0615", OTHER: "76f781e0-9f94-42a3-ac2a-8dc5a41a983d" };
  const postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265", revisionId = "929e3c76-4032-4a33-8543-01c500151111";
  const token = role => `test.${Buffer.from(JSON.stringify({ sub: ids[role], role: "AUTHOR" })).toString("base64url")}.test`;
  const post = { id: postId, authorId: ids.AUTHOR, title: "Titulo atual", content: "Conteudo atual sintetico", slug: "titulo-atual", published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  const revision = { id: revisionId, title: "Versao antiga", content: "Conteudo privado anterior", createdAt: "2026-01-01T12:00:00Z" }; let restores = 0, saves = 0, covers = 0, photos = 0;
  const api = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.url === "/api/v1/auth/login") { const role = JSON.parse(body).password; if (!ids[role]) return respond(401, {}); res.setHeader("Set-Cookie", `refreshToken=${role}; HttpOnly; Path=/api/v1/auth; SameSite=Strict`); return respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 }); }
    if (req.url === "/api/v1/auth/refresh") { const role = /refreshToken=(AUTHOR|OTHER)/.exec(req.headers.cookie || "")?.[1]; return role ? respond(200, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {}); }
    const role = Object.keys(ids).find(value => req.headers.authorization === `Bearer ${token(value)}`);
    if (role && req.url === `/api/v1/users/${ids[role]}/profile-photo` && req.method === "POST") { photos++; return respond(201, { id: ids[role], profilePhoto: "/uploads/profile-photos/550e8400-e29b-41d4-a716-446655440000.webp" }); }
    if (role && req.url === `/api/v1/users/${ids[role]}`) return respond(200, { id: ids[role], role: "AUTHOR", name: "Pessoa", email: "pessoa@example.test", emailVerified: true, bio: null, firstPostApproved: true });
    if (role !== "AUTHOR") return respond(403, {});
    if (req.url === `/api/v1/posts/${postId}` && req.method === "PATCH") { saves++; Object.assign(post, JSON.parse(body)); return respond(200, post); }
    if (req.url === `/api/v1/posts/${postId}/cover-image` && req.method === "POST") { covers++; post.coverImage = "/uploads/post-covers/550e8400-e29b-41d4-a716-446655440000.webp"; return respond(201, { coverImage: post.coverImage }); }
    if (req.url === `/api/v1/posts/${postId}`) return respond(200, post);
    if (req.url === `/api/v1/posts/${postId}/revisions?page=1&limit=10`) return respond(200, { data: [{ id: revision.id, title: revision.title, createdAt: revision.createdAt }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } });
    if (req.url === `/api/v1/posts/${postId}/revisions/${revisionId}`) return respond(200, revision);
    if (req.url === `/api/v1/posts/${postId}/revisions/${revisionId}/restore` && req.method === "POST") { restores++; if (post.reviewStatus === "PENDING") return respond(409, {}); Object.assign(post, { title: revision.title, content: revision.content }); const response = { ...post }; delete response.isActive; return respond(201, response); }
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
    assert.match(basename(tempReal), /^blog-revisions-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependÃªncias temporÃ¡rias nÃ£o sÃ£o junÃ§Ã£o");
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
  await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login");
  await fill("#email", "pessoa@example.test"); await fill("#password", "AUTHOR"); await click("Entrar"); await waitFor(() => evaluate("location.pathname === '/conta'"), "login done");
  const openEditor = async () => { await cdp("Page.navigate", { url: `${base}/studio/${postId}` }); await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Ver hist\u00f3rico')"), "editor"); };
  const openPreview = async () => { await click("Ver hist\u00f3rico"); await waitFor(() => has("Versao antiga"), "list"); await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Versao antiga')).click()"); await waitFor(() => has("Conteudo privado anterior"), "preview"); };
  await openEditor(); await openPreview();
  await fill("#article-content", "Alteracao nao salva");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Restaurar esta vers\u00e3o').disabled"), true); assert.equal(restores, 0);
  await fill("#article-content", "Conteudo atual sintetico"); await click("Restaurar esta vers\u00e3o"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirm"); await click("Cancelar"); assert.equal(restores, 0);
  await click("Restaurar esta vers\u00e3o"); await click("Restaurar vers\u00e3o"); await waitFor(() => has("Vers\u00e3o restaurada."), "restored"); assert.equal(restores, 1); assert.equal(await evaluate("document.querySelector('#article-content').value"), revision.content);
  await evaluate(`(async () => { const input = document.querySelector('input[type=file]'); const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 200; canvas.getContext('2d').fillRect(0, 0, 100, 200); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'cover.png', { type: 'image/png' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(() => has("Nova capa selecionada."), "cover selected");
  await evaluate("Array.from(document.querySelectorAll('label')).find(x => x.textContent.includes('Usar imagem inteira')).querySelector('input').click()");
  await waitFor(() => has("Posi\u00e7\u00e3o vertical"), "crop controls");
  assert.equal(covers, 0); assert.equal(saves, 0);
  await click("Salvar rascunho"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "save confirmation");
  await click("Cancelar"); assert.equal(covers, 0); assert.equal(saves, 0);
  await click("Salvar rascunho"); await click("Confirmar e salvar");
  await waitFor(() => covers === 1, "cover saved"); assert.equal(saves, 1);
  await cdp("Page.navigate", { url: `${base}/conta/foto` });
  await waitFor(() => evaluate("!!document.querySelector('#photo')"), "profile photo");
  await evaluate(`(async () => { const input = document.querySelector('#photo'); const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 200; canvas.getContext('2d').fillRect(0, 0, 100, 200); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'profile.png', { type: 'image/png' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(() => has("Posi\u00e7\u00e3o vertical"), "profile crop controls"); assert.equal(photos, 0);
  await click("Salvar foto"); await waitFor(() => has("Foto atualizada com sucesso."), "profile crop saved"); assert.equal(photos, 1);
  post.reviewStatus = "PENDING"; await openEditor(); await openPreview(); assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Restaurar esta vers\u00e3o').disabled"), true); assert.equal(restores, 1);
  post.reviewStatus = "DRAFT"; await openEditor(); await openPreview(); await click("Restaurar esta vers\u00e3o");
  const secondTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(base + "/entrar")}`, { method: "PUT" })).json();
  secondSocket = new WebSocket(secondTarget.webSocketDebuggerUrl); await once(secondSocket, "open"); let seq2 = 0; const pending2 = new Map();
  secondSocket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending2.has(data.id)) { const { resolve, reject } = pending2.get(data.id); pending2.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
  const cdp2 = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq2; pending2.set(id, { resolve, reject }); secondSocket.send(JSON.stringify({ id, method, params })); });
  const eval2 = async expression => { const result = await cdp2("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  await waitFor(() => eval2("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "second login");
  for (const [selector, value] of [["#email", "pessoa@example.test"], ["#password", "OTHER"]]) await eval2(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await eval2("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Entrar').click()"); await waitFor(() => eval2("location.pathname === '/conta'"), "switch");
  await waitFor(() => evaluate("!document.querySelector('dialog[open]')"), "dialog closed"); assert.equal(await has("Conteudo privado anterior"), false); assert.equal(restores, 1);
});
