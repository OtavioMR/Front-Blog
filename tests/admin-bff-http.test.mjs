import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const origin = "https://admin-test.example.test";
const postId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const privateText = "Conteúdo editorial sintético";

test("rotas administrativas permanecem indisponíveis com a flag desligada", { timeout: 30000 }, async t => {
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const app = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "-p", String(port)], { env: { ...process.env, ENABLE_ADMIN_BFF: "false" }, stdio: "ignore" });
  t.after(() => app.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) { try { await fetch(base + "/gestao-editorial"); ready = true; break; } catch { await delay(100); } }
  assert.ok(ready);
  for (const path of ["/gestao-editorial", "/gestao-editorial/entrar", "/gestao-editorial/denuncias", "/gestao-editorial/categorias", "/gestao-editorial/indicadores", "/gestao-editorial/usuarios"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
    if (!path.endsWith("indicadores") && !path.endsWith("usuarios")) assert.equal((await fetch(base + path, { method: "POST" })).status, 404, path);
  }
});

test("BFF editorial protege entradas, dados, ações e sessão", { timeout: 30000 }, async (t) => {
  const roles = new Map();
  const revoked = new Set();
  const decisions = [];
  const reportDecisions = [];
  const categoryChanges = [];
  let reportMode = "ok";
  let categoryMode = "ok";
  let invalidDecision = false;
  let invalidAnalytics = false;
  const api = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    let body = "";
    for await (const chunk of request) body += chunk;
    if (request.method === "POST" && request.url === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (!["READER", "AUTHOR", "ADMIN"].includes(role)) { response.statusCode = 401; return response.end("{}"); }
      const token = `fake-${role}-${roles.size}`;
      roles.set(token, role);
      return response.end(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 900 }));
    }
    if (request.method === "GET" && request.url === "/api/v1/categories?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, name: 'Categoria <teste>', slug: 'categoria-teste', description: 'Descrição sintética', isActive: true }], meta: { page: 1, hasPreviousPage: false, hasNextPage: true } }));
    if (request.method === "GET" && request.url === "/api/v1/categories?page=2&limit=20") return response.end(JSON.stringify({ data: [], meta: { page: 2, hasPreviousPage: true, hasNextPage: false } }));
    if (request.method === "GET" && request.url === `/api/v1/categories/${postId}`) return response.end(JSON.stringify({ id: postId, name: "Categoria <teste>", isActive: true }));
    const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!roles.has(token) || revoked.has(token)) { response.statusCode = 401; return response.end("{}"); }
    if (request.method === "POST" && request.url === "/api/v1/auth/logout") { revoked.add(token); return response.end("{}"); }
    if (roles.get(token) !== "ADMIN") { response.statusCode = 403; return response.end("{}"); }
    if (request.method === "GET" && request.url === "/api/v1/post-reviews") return response.end(JSON.stringify([{ id: postId, title: "Artigo sintético", content: `<p>${privateText}</p><script>alert(1)</script><img src=x onerror=alert(1)>` }]));
    if (request.method === "GET" && request.url === "/api/v1/admin/analytics/overview") return response.end(JSON.stringify({ users: { total: invalidAnalytics ? -1 : 5, active: 4, verified: 3 }, posts: { total: 2, published: 1, drafts: 1 }, comments: { total: 7, active: 6 }, reports: { total: 3, pending: 2 }, generatedAt: "2026-01-01T12:00:00.000Z" }));
    if (request.method === "GET" && request.url === "/api/v1/users?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, name: "Pessoa <teste>", email: "pessoa@example.test", role: "READER", isActive: true, emailVerified: true }], meta: { page: 1, hasPreviousPage: false, hasNextPage: true } }));
    if (request.method === "GET" && request.url === "/api/v1/users?page=2&limit=20") return response.end(JSON.stringify({ data: [], meta: { page: 2, hasPreviousPage: true, hasNextPage: false } }));
    if (["POST", "PATCH", "DELETE"].includes(request.method) && (request.url === "/api/v1/categories" || request.url === `/api/v1/categories/${postId}`)) { if (["conflict", "limited"].includes(categoryMode)) { response.statusCode = categoryMode === "conflict" ? 409 : 429; return response.end("{}"); } const payload = body ? JSON.parse(body) : null; categoryChanges.push({ method: request.method, body: payload }); if (categoryMode === "lost") { request.socket.destroy(); return; } response.statusCode = request.method === "DELETE" ? 204 : request.method === "POST" ? 201 : 200; return response.end(request.method === "DELETE" ? "" : JSON.stringify(categoryMode === "invalid" ? { id: postId, name: "Outro", isActive: true } : { id: postId, name: payload.name, description: payload.description, isActive: true })); }
    if (request.method === "GET" && request.url === "/api/v1/reports?status=PENDING&page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, postId, commentId: null, status: "PENDING", reason: "Motivo <script>privado</script>" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: reportMode === "pages" } }));
    if (request.method === "GET" && request.url === "/api/v1/reports?status=PENDING&page=2&limit=20") return response.end(JSON.stringify({ data: [], meta: { page: 2, hasPreviousPage: true, hasNextPage: false } }));
    if (request.method === "PATCH" && request.url === `/api/v1/reports/${postId}`) { if (["conflict", "invalid", "limited"].includes(reportMode)) { response.statusCode = { conflict: 409, invalid: 400, limited: 429 }[reportMode]; return response.end("{}"); } const input = JSON.parse(body); reportDecisions.push(input); return response.end(JSON.stringify({ id: postId, status: reportMode === "wrong-status" ? "PENDING" : input.status })); }
    if (request.method === "POST" && request.url === `/api/v1/post-reviews/${postId}/decision`) { const decision = JSON.parse(body).decision; decisions.push(decision); response.statusCode = 201; return response.end(JSON.stringify({ status: invalidDecision ? "PENDING" : decision })); }
    response.statusCode = 404;
    return response.end("{}");
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  t.after(() => api.close());

  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const app = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    env: { ...process.env, NODE_ENV: "production", SITE_ORIGIN: origin, API_ORIGIN: `http://127.0.0.1:${api.address().port}`, ENABLE_ADMIN_BFF: "true" },
    stdio: "ignore",
  });
  t.after(() => app.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) break;
    try { await fetch(`${base}/gestao-editorial`); ready = true; break; } catch { await delay(100); }
  }
  assert.ok(ready, "servidor Next não iniciou; execute npm run build antes do teste");

  const request = (path, init = {}) => fetch(`${base}${path}`, { redirect: "manual", ...init });
  const csrfFrom = (html) => { const match = html.match(/name="csrf" value="([^"]+)"/); assert.ok(match, "CSRF ausente"); return match[1]; };
  const findCookie = (response, name) => response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  const form = (path, values, cookie, requestOrigin = origin) => request(path, { method: "POST", headers: { Origin: requestOrigin, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values) });
  const login = async (role) => {
    const start = await request("/gestao-editorial/entrar");
    assert.equal(start.status, 200);
    assert.match(start.headers.get("cache-control"), /no-store/);
    const csrf = csrfFrom(await start.text());
    const loginCookie = findCookie(start, "__Host-editorial-login");
    assert.match(loginCookie, /HttpOnly/i); assert.match(loginCookie, /Secure/i); assert.match(loginCookie, /SameSite=Strict/i); assert.match(loginCookie, /Path=\//i); assert.doesNotMatch(loginCookie, /Domain=/i);
    return form("/gestao-editorial/entrar", { csrf, email: "fixture@example.test", password: role }, loginCookie.split(";")[0]);
  };

  let response = await request("/gestao-editorial");
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await request("/gestao-editorial/denuncias")).status, 401);
  assert.equal((await request("/gestao-editorial/indicadores")).status, 401);
  assert.equal((await request("/gestao-editorial/categorias")).status, 401);
  assert.equal((await request("/gestao-editorial/usuarios")).status, 401);
  assert.match(response.headers.get("cache-control"), /no-store/);
  for (const role of ["READER", "AUTHOR"]) {
    response = await login(role);
    assert.equal(response.status, 403);
    assert.equal(findCookie(response, "__Host-editorial-session"), undefined);
  }
  response = await login("ADMIN");
  assert.equal(response.status, 303);
  const rawCookie = findCookie(response, "__Host-editorial-session");
  assert.ok(rawCookie); assert.match(rawCookie, /HttpOnly/i); assert.match(rawCookie, /Secure/i); assert.match(rawCookie, /SameSite=Strict/i); assert.match(rawCookie, /Path=\//i); assert.doesNotMatch(rawCookie, /Domain=/i);
  const sessionCookie = rawCookie.split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, new RegExp(privateText));
  assert.doesNotMatch(html, /<script|<img|onerror/i); assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "same-origin");
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  const csrf = csrfFrom(html);
  response = await request("/gestao-editorial/indicadores", { headers: { Cookie: sessionCookie } });
  const analytics = await response.text();
  assert.equal(response.status, 200); assert.match(analytics, /Usuários/); assert.match(analytics, /<dd>5<\/dd>/); assert.match(response.headers.get("cache-control"), /no-store/);
  invalidAnalytics = true;
  assert.equal((await request("/gestao-editorial/indicadores", { headers: { Cookie: sessionCookie } })).status, 503);
  invalidAnalytics = false;
  response = await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } });
  const usersHtml = await response.text();
  assert.equal(response.status, 200); assert.match(usersHtml, /Pessoa &lt;teste&gt;/); assert.match(usersHtml, /pessoa@example.test/); assert.match(response.headers.get("cache-control"), /no-store/); assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.match(usersHtml, /href="\?page=2"/);
  response = await request("/gestao-editorial/usuarios?page=2", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.match(await response.text(), /href="\?page=1"/);
  assert.equal((await request("/gestao-editorial/usuarios?page=1&page=2", { headers: { Cookie: sessionCookie } })).status, 400);
  response = await request("/gestao-editorial/categorias", { headers: { Cookie: sessionCookie } });
  const categoriesHtml = await response.text();
  assert.equal(response.status, 200); assert.match(categoriesHtml, /Categoria &lt;teste&gt;/); assert.doesNotMatch(categoriesHtml, /Categoria <teste>/);
  assert.match(categoriesHtml, /href="\?page=2"/);
  response = await request("/gestao-editorial/categorias?page=2", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.match(await response.text(), /href="\?page=1"/);
  assert.equal((await request("/gestao-editorial/categorias?page=1&page=2", { headers: { Cookie: sessionCookie } })).status, 400);
  const categoryCsrf = csrfFrom(categoriesHtml);
  const categoryCreate = { csrf: categoryCsrf, action: "create", name: "Categoria sintética", description: "Teste" };
  assert.equal((await form("/gestao-editorial/categorias", categoryCreate, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form("/gestao-editorial/categorias", { ...categoryCreate, csrf: "invalid" }, sessionCookie)).status, 403);
  assert.deepEqual(categoryChanges, []);
  assert.equal((await form("/gestao-editorial/categorias", categoryCreate, sessionCookie)).status, 303);
  assert.equal((await form("/gestao-editorial/categorias", { csrf: categoryCsrf, action: "edit", id: postId, name: "Nome editado", slug: "nome-editado", description: "Teste" }, sessionCookie)).status, 303);
  response = await form("/gestao-editorial/categorias", { csrf: categoryCsrf, action: "confirm-delete", id: postId }, sessionCookie);
  assert.equal(response.status, 200); const confirmation = await response.text(); assert.match(confirmation, /Confirmar desativação/); assert.match(confirmation, /Categoria &lt;teste&gt;/); assert.equal(categoryChanges.length, 2);
  assert.equal((await form("/gestao-editorial/categorias", { csrf: categoryCsrf, action: "delete", id: postId }, sessionCookie)).status, 303);
  assert.deepEqual(categoryChanges, [{ method: "POST", body: { name: "Categoria sintética", description: "Teste" } }, { method: "PATCH", body: { name: "Nome editado", description: "Teste", slug: "nome-editado" } }, { method: "DELETE", body: null }]);
  categoryMode = "conflict";
  response = await form("/gestao-editorial/categorias", { ...categoryCreate, description: "<script>texto</script>" }, sessionCookie);
  assert.equal(response.status, 409); const conflictHtml = await response.text(); assert.match(conflictHtml, /&lt;script&gt;texto&lt;\/script&gt;/); assert.doesNotMatch(conflictHtml, /<script>texto<\/script>/);
  assert.equal(categoryChanges.length, 3);
  categoryMode = "limited";
  response = await form("/gestao-editorial/categorias", categoryCreate, sessionCookie);
  assert.equal(response.status, 429); assert.match(await response.text(), /Categoria sintética/);
  assert.equal(categoryChanges.length, 3);
  categoryMode = "lost";
  response = await form("/gestao-editorial/categorias", categoryCreate, sessionCookie);
  assert.equal(response.status, 503); const lostHtml = await response.text(); assert.match(lostHtml, /Confira a lista antes de tentar novamente/); assert.match(lostHtml, /Categoria sintética/);
  assert.equal(categoryChanges.length, 4);
  categoryMode = "invalid";
  response = await form("/gestao-editorial/categorias", categoryCreate, sessionCookie);
  assert.equal(response.status, 503); assert.match(await response.text(), /Resultado incerto/);
  assert.equal(categoryChanges.length, 5);
  categoryMode = "ok";
  const decision = { csrf, id: postId, decision: "APPROVED" };
  assert.equal((await form("/gestao-editorial", decision, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form("/gestao-editorial", { ...decision, csrf: "invalid" }, sessionCookie)).status, 403);
  assert.deepEqual(decisions, []);
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 303);
  assert.deepEqual(decisions, ["APPROVED"]);
  invalidDecision = true;
  response = await form("/gestao-editorial", decision, sessionCookie);
  assert.equal(response.status, 503); assert.match(await response.text(), /Confira a fila antes de tentar novamente/);
  assert.deepEqual(decisions, ["APPROVED", "APPROVED"]);
  decisions.pop();
  invalidDecision = false;

  response = await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } });
  const reportsHtml = await response.text();
  assert.equal(response.status, 200); assert.match(reportsHtml, /Motivo &lt;script&gt;privado/); assert.doesNotMatch(reportsHtml, /<script>/);
  assert.match(response.headers.get("cache-control"), /no-store/); assert.match(response.headers.get("x-robots-tag"), /noindex/);
  const reportDecision = { csrf: csrfFrom(reportsHtml), id: postId, decision: "RESOLVED", note: "Análise sintética" };
  assert.equal((await form("/gestao-editorial/denuncias", reportDecision, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form("/gestao-editorial/denuncias", { ...reportDecision, csrf: "invalid" }, sessionCookie)).status, 403);
  assert.equal((await form("/gestao-editorial/denuncias", { ...reportDecision, decision: "PENDING" }, sessionCookie)).status, 400);
  assert.deepEqual(reportDecisions, []);
  assert.equal((await form("/gestao-editorial/denuncias", reportDecision, sessionCookie)).status, 303);
  assert.deepEqual(reportDecisions, [{ status: "RESOLVED", note: "Análise sintética" }]);
  reportMode = "wrong-status";
  const uncertainReport = await form("/gestao-editorial/denuncias", { ...reportDecision, note: "<script>nota</script>" }, sessionCookie);
  assert.equal(uncertainReport.status, 503);
  const uncertainReportHtml = await uncertainReport.text();
  assert.match(uncertainReportHtml, /Resultado incerto/); assert.match(uncertainReportHtml, /&lt;script&gt;nota&lt;\/script&gt;/); assert.doesNotMatch(uncertainReportHtml, /<script>nota<\/script>/);
  assert.match(uncertainReport.headers.get("cache-control"), /no-store/);
  assert.equal(reportDecisions.length, 2);
  reportDecisions.pop();
  reportMode = "conflict";
  response = await form("/gestao-editorial/denuncias", reportDecision, sessionCookie);
  assert.equal(response.status, 409); assert.match(await response.text(), /Análise sintética/);
  assert.equal(reportDecisions.length, 1);
  reportMode = "invalid";
  response = await form("/gestao-editorial/denuncias", reportDecision, sessionCookie);
  assert.equal(response.status, 400); assert.match(await response.text(), /Confira os dados da análise/);
  reportMode = "limited";
  response = await form("/gestao-editorial/denuncias", reportDecision, sessionCookie);
  assert.equal(response.status, 429); assert.match(await response.text(), /Aguarde antes de tentar/);
  assert.equal(reportDecisions.length, 1);
  reportMode = "pages";
  response = await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } });
  assert.match(await response.text(), /href="\?page=2"/);
  response = await request("/gestao-editorial/denuncias?page=2", { headers: { Cookie: sessionCookie } });
  const secondPage = await response.text();
  assert.equal(response.status, 200); assert.match(secondPage, /href="\?page=1"/); assert.match(secondPage, /Nenhuma denúncia nesta página/);
  assert.equal((await request("/gestao-editorial/denuncias?page=1&page=2", { headers: { Cookie: sessionCookie } })).status, 400);
  reportMode = "ok";

  const adminToken = [...roles.entries()].find(([, role]) => role === "ADMIN")[0];
  roles.set(adminToken, "AUTHOR");
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 403);
  assert.equal((await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request("/gestao-editorial/indicadores", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request("/gestao-editorial/categorias", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await form("/gestao-editorial/categorias", categoryCreate, sessionCookie)).status, 403);
  assert.equal((await form("/gestao-editorial/denuncias", reportDecision, sessionCookie)).status, 403);
  assert.deepEqual(decisions, ["APPROVED"]);
  roles.set(adminToken, "ADMIN");
  revoked.add(adminToken);
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 401);
  assert.equal((await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request("/gestao-editorial/indicadores", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request("/gestao-editorial/categorias", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await form("/gestao-editorial/categorias", categoryCreate, sessionCookie)).status, 401);
  assert.equal((await form("/gestao-editorial/denuncias", reportDecision, sessionCookie)).status, 401);
  assert.deepEqual(decisions, ["APPROVED"]);

  response = await login("ADMIN");
  assert.equal(response.status, 303);
  const nextCookie = findCookie(response, "__Host-editorial-session").split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: nextCookie } });
  const nextCsrf = csrfFrom(await response.text());
  assert.equal((await form("/gestao-editorial", { csrf: nextCsrf, action: "logout" }, nextCookie)).status, 303);
  response = await request("/gestao-editorial", { headers: { Cookie: nextCookie } });
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), new RegExp(privateText));
});
