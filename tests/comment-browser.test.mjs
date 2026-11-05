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
test("comentarios e respostas preservam permissoes e discussao na API simulada", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "blog-comments-e2e-"));
  for (const name of ["src", "public", "package.json", "next.config.ts", "tsconfig.json"]) {
    await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  }
  await symlink(join(process.cwd(), "node_modules"), join(temp, "node_modules"), "junction");

  const authorId = "4c781e0d-b963-493c-b2df-0a8fa66c0615", postId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const otherId = "76f781e0-9f94-42a3-ac2a-8dc5a41a983d", rootId = "929e3c76-4032-4a33-8543-01c500151111", replyId = "929e3c76-4032-4a33-8543-01c500152222";
  const adminId = "8d779824-0a9f-442f-8652-a81600000001";
  const profiles = { READER: { id: authorId, role: "READER" }, AUTHOR: { id: otherId, role: "AUTHOR" }, ADMIN: { id: adminId, role: "ADMIN" } };
  const token = role => `test.${Buffer.from(JSON.stringify({ sub: profiles[role].id, role })).toString("base64url")}.test`;
  const article = { id: postId, slug: "uma-historia", title: "Historia sintetica", excerpt: "Resumo", content: "<p>Conteudo</p>", coverImage: null, publishedAt: "2026-01-01T12:00:00Z", published: true, isActive: true, readingTimeMinutes: 1, author: { id: otherId, name: "Autora" }, categories: [] };
  const comment = (id, rootId, author, content) => ({ id, postId, rootId, author, content, isActive: true, createdAt: "2026-01-01T00:00:00Z", editedAt: null });
  const root = comment(rootId, null, { id: authorId, name: "Leitora" }, "Comentario original");
  const reply = comment(replyId, rootId, { id: otherId, name: "Outra pessoa" }, "Resposta preservada");
  const ownReply = comment("929e3c76-4032-4a33-8543-01c500153333", rootId, { id: authorId, name: "Leitora" }, "Resposta propria");
  let mutations = 0;
  const api = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    let body = ""; for await (const chunk of req) body += chunk;
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (!profiles[role]) return respond(401, {});
      res.setHeader("Set-Cookie", `refreshToken=${role}; HttpOnly; Path=/api/v1/auth; SameSite=Strict`);
      return respond(201, { access_token: token(role), token_type: "Bearer", expires_in: 900 });
    }
    if (url.pathname === "/api/v1/auth/refresh") {
      const role = /refreshToken=(READER|AUTHOR|ADMIN)/.exec(req.headers.cookie || "")?.[1];
      return role ? respond(200, { access_token: token(role), token_type: "Bearer", expires_in: 900 }) : respond(401, {});
    }
    const role = Object.keys(profiles).find(value => req.headers.authorization === `Bearer ${token(value)}`);
    if (url.pathname.startsWith("/api/v1/users/")) {
      const profile = role && profiles[role];
      return profile && url.pathname === `/api/v1/users/${profile.id}` ? respond(200, { ...profile, name: role, email: "pessoa@example.test", emailVerified: true, bio: null }) : respond(403, {});
    }
    if (url.pathname === "/api/v1/posts/uma-historia") return respond(200, article);
    if (url.pathname === "/api/v1/posts/uma-historia/related") return respond(200, []);
    if (url.pathname === `/api/v1/posts/${postId}/comments`) return respond(200, { data: [{ ...root, replies: { data: [reply, ownReply], meta: { total: 2 } } }], meta: { page: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });
    if (url.pathname.startsWith("/api/v1/comments/") && role) {
      const target = url.pathname.endsWith(rootId) ? root : url.pathname.endsWith(replyId) ? reply : url.pathname.endsWith(ownReply.id) ? ownReply : null;
      if (!target) return respond(404, {});
      if (target.author.id !== profiles[role].id && role !== "ADMIN" && !(req.method === "DELETE" && profiles[role].id === article.author.id)) return respond(403, {});
      mutations++;
      if (req.method === "PATCH") { target.content = JSON.parse(body).content; target.editedAt = "2026-01-02T00:00:00Z"; return respond(200, target); }
      if (req.method === "DELETE") { target.isActive = false; res.statusCode = 204; return res.end(); }
    }
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
    assert.match(basename(tempReal), /^blog-comments-e2e-/);
    assert.ok((await lstat(link)).isSymbolicLink(), "dependÃªncias temporÃ¡rias nÃ£o sÃ£o junÃ§Ã£o");
    const target = resolve(dirname(link), await readlink(link));
    assert.equal((await realpath(target)).toLowerCase(), (await realpath(join(process.cwd(), "node_modules"))).toLowerCase());
    await unlink(link);
    await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  async function waitFor(action, label) { for (let i = 0; i < 200; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Tempo esgotado: ${label}`); }
  await waitFor(async () => (await fetch(`${base}/posts/uma-historia`)).status === 200, "Next").catch(error => { throw new Error(`${error.message}\n${appOutput}`); });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === "page" && item.url === "about:blank"), "Chromium; defina CHROME_PATH");
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let sequence = 0; const pending = new Map();
  socket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await cdp("Page.navigate", { url: `${base}/posts/uma-historia` });
  await waitFor(() => has("Comentario original"), "comentario publico");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Ver 2 respostas' && Object.keys(x).some(k => k.startsWith('__reactProps')))"), "hydration");
  await click("Ver 2 respostas");
  await waitFor(() => has("Resposta preservada"), "resposta");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Editar')"), false);
  await cdp("Page.navigate", { url: `${base}/entrar` });
  await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hidratado");
  await fill("#email", "leitora@example.test"); await fill("#password", "READER"); await click("Entrar");
  await waitFor(() => evaluate("location.pathname === '/conta'"), "entrada");
  await cdp("Page.navigate", { url: `${base}/posts/uma-historia` });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Editar')"), "permissao de edicao");
  await click("Ver 2 respostas");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'Editar').length"), 2);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'Desativar').length"), 2);
  await click("Editar"); await fill("textarea:not([id])", "Comentario editado"); await click("Salvar");
  await waitFor(() => has("Coment\u00e1rio atualizado."), "edicao");
  assert.equal(root.content, "Comentario editado"); assert.equal(await has("Resposta preservada"), true); assert.equal(mutations, 1);
  await evaluate("Array.from(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'Editar')[1].click()");
  await fill("textarea:not([id])", "Resposta editada"); await click("Salvar");
  await waitFor(() => has("Resposta editada"), "edicao da resposta"); assert.equal(ownReply.content, "Resposta editada");
  await evaluate("Array.from(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'Desativar')[1].click()");
  await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "dialogo da resposta"); await click("Desativar coment\u00e1rio");
  await waitFor(() => evaluate("document.body.innerText.includes('Coment\u00e1rio exclu\u00eddo')"), "desativacao da resposta");
  assert.equal(ownReply.isActive, false); assert.equal(await has("Resposta preservada"), true);
  await click("Desativar");
  await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "dialogo de desativacao");
  await click("Cancelar"); assert.equal(root.isActive, true); assert.equal(mutations, 3);
  await click("Desativar"); await click("Desativar coment\u00e1rio");
  await waitFor(() => !root.isActive && evaluate("!Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Responder')"), "desativacao");
  assert.equal(root.isActive, false); assert.equal(mutations, 4);
  assert.equal(await has("Resposta preservada"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Responder')"), false);
  // The fixture enforces the API rules independently of hidden UI controls.
  const direct = (role, method, id) => fetch(`http://127.0.0.1:${api.address().port}/api/v1/comments/${id}`, { method, headers: { Authorization: `Bearer ${token(role)}`, "Content-Type": "application/json" }, ...(method === "PATCH" ? { body: JSON.stringify({ content: "nao permitido" }) } : {}) });
  assert.equal((await direct("READER", "PATCH", replyId)).status, 403);
  assert.equal((await direct("AUTHOR", "PATCH", rootId)).status, 403);
  root.isActive = true; root.content = "Comentario original"; ownReply.isActive = true;
  const enter = async role => {
    await cdp("Page.navigate", { url: `${base}/entrar` });
    await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "login hidratado");
    await fill("#email", "pessoa@example.test"); await fill("#password", role); await click("Entrar");
    await waitFor(() => evaluate("location.pathname === '/conta'"), `entrada ${role}`);
    await cdp("Page.navigate", { url: `${base}/posts/uma-historia` });
  };
  await enter("AUTHOR");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Desativar')"), "autor do artigo");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Editar')"), false);
  await click("Desativar"); await click("Desativar coment\u00e1rio");
  await waitFor(() => !root.isActive, "autor desativa comentario de terceiro");
  root.isActive = true;
  await enter("ADMIN");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Editar')"), "administrador");
  await click("Editar"); await fill("textarea:not([id])", "Moderacao administrativa"); await click("Salvar");
  await waitFor(() => root.content === "Moderacao administrativa", "administrador edita terceiro");
  await click("Desativar"); await click("Desativar coment\u00e1rio");
  await waitFor(() => !root.isActive, "administrador desativa terceiro");
  root.isActive = true; root.content = "Comentario original";
  await enter("READER");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Editar')"), "retorno da leitora");
  const secondTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(base + "/entrar")}`, { method: "PUT" })).json();
  secondSocket = new WebSocket(secondTarget.webSocketDebuggerUrl); await once(secondSocket, "open");
  let seq2 = 0; const pending2 = new Map();
  secondSocket.addEventListener("message", event => { const data = JSON.parse(event.data); if (pending2.has(data.id)) { const { resolve, reject } = pending2.get(data.id); pending2.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
  const cdp2 = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq2; pending2.set(id, { resolve, reject }); secondSocket.send(JSON.stringify({ id, method, params })); });
  const eval2 = async expression => { const result = await cdp2("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const loginSecond = async role => {
    await cdp2("Page.navigate", { url: `${base}/entrar` });
    await waitFor(() => eval2("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k => k.startsWith('__reactProps'))"), "segunda aba hidratada");
    for (const [selector, value] of [["#email", "pessoa@example.test"], ["#password", role]]) await eval2(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await eval2("Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Entrar').click()");
    await waitFor(() => eval2("location.pathname === '/conta'"), `troca para ${role}`);
  };
  await click("Editar"); await fill("textarea:not([id])", "Texto preservado na troca");
  const beforeSwitch = mutations;
  await loginSecond("ADMIN");
  await waitFor(() => evaluate("document.querySelector('textarea:not([id])')?.value === 'Texto preservado na troca'"), "texto preservado");
  await click("Salvar");
  await waitFor(() => has("A conta mudou") || has("Entre novamente"), "troca durante edicao");
  assert.equal(root.content, "Comentario original"); assert.equal(mutations, beforeSwitch);
  assert.equal(await evaluate("document.querySelector('textarea:not([id])').value"), "Texto preservado na troca");
  await enter("READER");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === 'Desativar')"), "leitora antes da confirmacao");
  await click("Desativar"); await waitFor(() => evaluate("!!document.querySelector('dialog[open]')"), "confirmacao aberta");
  await loginSecond("ADMIN");
  await click("Desativar coment\u00e1rio");
  await waitFor(() => has("A conta mudou") || has("Entre novamente"), "troca durante confirmacao");
  assert.equal(root.isActive, true); assert.equal(mutations, beforeSwitch);
});
