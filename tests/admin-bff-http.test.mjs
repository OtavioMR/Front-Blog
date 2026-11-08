import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const frontDir = fileURLToPath(new URL("..", import.meta.url));
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const origin = "https://admin-test.example.test";
const postId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const actorId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const privateText = "Conteúdo editorial sintético";

test("rotas administrativas permanecem indisponíveis com a flag desligada", { timeout: 30000 }, async t => {
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const app = spawn(process.execPath, [nextBin, "start", "-p", String(port)], { cwd: frontDir, env: { ...process.env, ENABLE_ADMIN_BFF: "false" }, stdio: "ignore" });
  t.after(() => app.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) { try { await fetch(base + "/gestao-editorial"); ready = true; break; } catch { await delay(100); } }
  assert.ok(ready);
  const protectedPaths = ["", "/entrar", "/denuncias", "/artigos", "/comentarios", "/usuarios", "/administradores", "/categorias", "/tags", "/estatisticas", "/newsletter", "/auditoria", "/conta"];
  for (const path of protectedPaths.map(value => "/gestao-editorial" + value)) assert.equal((await fetch(base + path)).status, 404, path);
  for (const path of ["/gestao-editorial/entrar/sessao", "/gestao-editorial/sair", "/gestao-editorial/categorias/acao", "/gestao-editorial/tags/acao"]) assert.equal((await fetch(base + path, { method: "POST" })).status, 404, path);
  for (const path of ["/admin", "/admin/users", "/gestao-editorial/indicadores"]) assert.equal((await fetch(base + path)).status, 404, path);
});

test("BFF editorial protege entradas, dados, ações e sessão", { timeout: 30000 }, async (t) => {
  const roles = new Map();
  const revoked = new Set();
  const decisions = [];
  const decisionBodies = [];
  const reportDecisions = [];
  const reportActions = [];
  const userActions = [];
  const auditQueries = [];
  const commentActions = [];
  const roleChanges = [];
  const categoryChanges = [];
  let reportMode = "ok";
  let categoryMode = "ok";
  let invalidDecision = false;
  let invalidAnalytics = false;
  let userSuspended = true;
  let userActionMode = "ok";
  let commentMode = "ok";
  const api = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    let body = "";
    for await (const chunk of request) body += chunk;
    if (request.method === "POST" && request.url === "/api/v1/auth/login") {
      const role = JSON.parse(body).password;
      if (!["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(role)) { response.statusCode = 401; return response.end("{}"); }
      const token = `header.${Buffer.from(JSON.stringify({ sub: actorId })).toString("base64url")}.signature-${roles.size}`;
      roles.set(token, role);
      response.setHeader("Set-Cookie", "refreshToken=synthetic.refresh.token; HttpOnly; Path=/api/v1/auth; SameSite=Strict");
      return response.end(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 900 }));
    }
    if (request.method === "GET" && request.url === "/api/v1/categories?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, name: 'Categoria <teste>', slug: 'categoria-teste', description: 'Descrição sintética', isActive: true }], meta: { page: 1, hasPreviousPage: false, hasNextPage: true } }));
    if (request.method === "GET" && request.url === "/api/v1/categories?page=2&limit=20") return response.end(JSON.stringify({ data: [], meta: { page: 2, hasPreviousPage: true, hasNextPage: false } }));
    if (request.method === "GET" && request.url === `/api/v1/categories/${postId}`) return response.end(JSON.stringify({ id: postId, name: "Categoria <teste>", isActive: true }));
    const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!roles.has(token) || revoked.has(token)) { response.statusCode = 401; return response.end("{}"); }
    if (request.method === "POST" && request.url === "/api/v1/auth/logout") { revoked.add(token); return response.end("{}"); }
    if (roles.get(token) !== "ADMIN" && roles.get(token) !== "SUPER_ADMIN") { response.statusCode = 403; return response.end("{}"); }
    if (request.method === "GET" && request.url === `/api/v1/users/${actorId}`) return response.end(JSON.stringify({ id: actorId, role: roles.get(token) }));
    if (request.method === "PATCH" && request.url === `/api/v1/admin/users/${postId}/role`) { if (roles.get(token) !== "SUPER_ADMIN") { response.statusCode = 403; return response.end("{}"); } if (request.headers["x-totp-code"] !== "123456") { response.statusCode = 401; return response.end("{}"); } const payload = JSON.parse(body); roleChanges.push(payload); return response.end(JSON.stringify({ id: postId, role: payload.role })); }
    if (request.method === "GET" && request.url === "/api/v1/post-reviews") return response.end(JSON.stringify([{ id: postId, title: "Artigo sintético", content: `<p>${privateText}</p><script>alert(1)</script><img src=x onerror=alert(1)>` }]));
    if (request.method === "GET" && request.url === "/api/v1/admin/analytics/overview") return response.end(JSON.stringify({ users: { total: invalidAnalytics ? -1 : 5, active: 4, verified: 3 }, posts: { total: 2, published: 1, drafts: 1 }, comments: { total: 7, active: 6 }, reports: { total: 3, pending: 2 }, generatedAt: "2026-01-01T12:00:00.000Z" }));
    if (request.method === "GET" && request.url === "/api/v1/admin/analytics/newsletter") return response.end(JSON.stringify({ subscribers: { total: 8, active: 5, pending: 2 }, deliveries: { pending: 1, retrying: 0, sent: 12 }, generatedAt: "2026-01-01T12:00:00.000Z" }));
    if (request.method === "GET" && request.url === "/api/v1/admin/analytics/activity") return response.end(JSON.stringify({ from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T23:59:00.000Z", series: [{ day: "2026-01-01", users: 2, posts: 1, reports: 3, subscribers: 4 }], recentPosts: [{ id: postId, title: "Artigo <sintético>", publishedAt: "2026-01-01T12:00:00.000Z" }], recentActions: [{ id: postId, action: "report.review", createdAt: "2026-01-01T12:00:00.000Z" }] }));
    const adminRowId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const listing = (data, hasNextPage = false) => response.end(JSON.stringify({ data, meta: { page: 1, hasPreviousPage: false, hasNextPage } }));
    const userRow = (id, name, role) => ({ id, name, email: `${name.split(" ")[0].toLowerCase()}@example.test`, role, isActive: true, moderationSuspended: false, createdAt: "2026-01-01T12:00:00.000Z" });
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=20&role=ADMIN&status=active&sort=name&order=ASC") return listing([userRow(adminRowId, "Moderadora <Teste>", "ADMIN")]);
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=20&role=SUPER_ADMIN&status=active&sort=name&order=ASC") return listing([userRow(actorId, "Dona <Raiz>", "SUPER_ADMIN")]);
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=20&role=ADMIN&sort=name&order=ASC") return listing([userRow(adminRowId, "Moderadora <Teste>", "ADMIN")]);
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=20&role=SUPER_ADMIN&sort=name&order=ASC") return listing([userRow(actorId, "Dona <Raiz>", "SUPER_ADMIN")]);
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=10&search=Pessoa&status=active") return listing([userRow(postId, "Pessoa <teste>", "READER"), userRow(adminRowId, "Moderadora <Teste>", "ADMIN")]);
    if (request.method === "GET" && request.url === "/api/v1/admin/audit-logs?page=1&limit=10&action=user.permissions_changed&targetType=user") return listing([{ id: postId, actorId, action: "user.permissions_changed", targetType: "user", targetId: adminRowId, createdAt: "2026-01-01T12:00:00.000Z", details: { previousRole: "READER", role: "ADMIN", reason: "Concessão <sintética>" } }]);
    if (request.method === "GET" && request.url.startsWith("/api/v1/admin/audit-logs?")) { auditQueries.push(request.url); const missing = request.url.includes("search=removido"); return response.end(JSON.stringify({ data: [{ id: postId, actorId: postId, actorName: missing ? null : "Moderadora sintética", targetLabel: missing ? null : "Conteúdo sintético", action: "report.review", targetType: "report", targetId: postId, createdAt: "2026-01-01T12:00:00.000Z", details: { reason: "Motivo <sintético>" } }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } })); }
    if (request.method === "GET" && request.url === "/api/v1/admin/comments?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, postId, authorId: postId, content: "Comentário <sintético>", isActive: true, moderationHidden: false, createdAt: "2026-01-01T12:00:00.000Z" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "GET" && request.url === `/api/v1/admin/comments/${postId}`) return response.end(JSON.stringify({ id: postId, postId, authorId: postId, rootId: null, replyToId: null, content: "Comentário <sintético>", isActive: true, moderationHidden: false, createdAt: "2026-01-01T12:00:00.000Z", reports: [{ id: postId, status: "PENDING", reason: "Motivo <privado>", createdAt: "2026-01-01T12:00:00.000Z" }] }));
    if (request.method === "GET" && request.url === `/api/v1/admin/comments/${postId}/history?page=1&limit=10`) return response.end(JSON.stringify({ data: [{ id: postId, actorId: postId, action: "comment.hide", createdAt: "2026-01-01T12:00:00.000Z", details: { reason: "Decisão sintética" } }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "POST" && request.url === `/api/v1/admin/comments/${postId}/hide`) { commentActions.push(JSON.parse(body)); response.statusCode = 201; return response.end(JSON.stringify({ id: postId, isActive: commentMode === "wrong", moderationHidden: true })); }
    if (request.method === "GET" && request.url === "/api/v1/admin/posts?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, title: "Artigo <privado>", authorId: postId, published: true, reviewStatus: "APPROVED", isActive: true, moderationHidden: false, createdAt: "2026-01-01T12:00:00.000Z" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "GET" && request.url === `/api/v1/admin/posts/${postId}`) return response.end(JSON.stringify({ id: postId, title: "Artigo <privado>", authorId: postId, author: { name: "Autor sintético" }, content: "<p>Conteúdo privado</p><script>alert(1)</script>", published: true, reviewStatus: "APPROVED", reviewNote: null, isActive: true, moderationHidden: false }));
    if (request.method === "GET" && request.url === `/api/v1/admin/posts/${postId}/history?page=1&limit=10`) return response.end(JSON.stringify({ data: [{ id: postId, actorId: postId, action: "post.review", createdAt: "2026-01-01T12:00:00.000Z", details: { reason: "Decisão editorial" } }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "POST" && request.url === `/api/v1/admin/posts/${postId}/hide`) { response.statusCode = 201; return response.end(JSON.stringify({ id: postId, isActive: false, moderationHidden: true })); }
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, name: "Pessoa <teste>", email: "pessoa@example.test", role: "SUPER_ADMIN", isActive: true, moderationSuspended: false, createdAt: "2026-01-01T12:00:00.000Z" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: true } }));
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=2&limit=20") return response.end(JSON.stringify({ data: [], meta: { page: 2, hasPreviousPage: true, hasNextPage: false } }));
    if (request.method === "GET" && request.url === "/api/v1/admin/users?page=1&limit=20&search=Pessoa&status=suspended") return response.end(JSON.stringify({ data: [{ id: postId, name: "Pessoa <teste>", email: "pessoa@example.test", role: "READER", isActive: false, moderationSuspended: true, createdAt: "2026-01-01T12:00:00.000Z" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: true } }));
    if (request.method === "GET" && request.url === `/api/v1/admin/users/${postId}`) return response.end(JSON.stringify({ id: postId, name: "Pessoa <teste>", email: "pessoa@example.test", role: "READER", isActive: !userSuspended, moderationSuspended: userSuspended, emailVerified: true, createdAt: "2026-01-01T12:00:00.000Z", counts: { posts: 2, comments: 3 } }));
    if (request.method === "GET" && request.url === `/api/v1/admin/users/${postId}/moderation-history?page=1&limit=10`) return response.end(JSON.stringify({ data: [{ actorId: postId, action: "user.suspend", createdAt: "2026-01-01T12:00:00.000Z" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "GET" && request.url === `/api/v1/admin/users/${postId}/reports?page=1&limit=10`) return response.end(JSON.stringify({ data: [{ id: postId, reason: "Motivo <teste>", status: "PENDING", createdAt: "2026-01-01T12:00:00.000Z", reporterId: "não exibir" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "POST" && request.url === `/api/v1/admin/users/${postId}/restore`) { userActions.push({ action: "restore", body: JSON.parse(body) }); userSuspended = false; response.statusCode = 201; return response.end(JSON.stringify({ suspended: false })); }
    if (request.method === "POST" && request.url === `/api/v1/admin/users/${postId}/suspension`) { if (userActionMode === "conflict") { response.statusCode = 409; return response.end("{}"); } userActions.push({ action: "suspend", body: JSON.parse(body) }); userSuspended = true; if (userActionMode === "lost") { request.socket.destroy(); return; } response.statusCode = 201; return response.end(JSON.stringify({ suspended: true, endsAt: null })); }
    if (request.method === "POST" && request.url === `/api/v1/admin/users/${postId}/sessions/revoke`) { userActions.push({ action: "revoke-sessions", body: JSON.parse(body) }); response.statusCode = 201; return response.end(JSON.stringify({ revoked: true })); }
    if (request.method === "GET" && request.url === "/api/v1/admin/categories?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, name: "Categoria <teste>", slug: "categoria-teste", description: "Descrição", isActive: true, deletedAt: null, postCount: 5 }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "GET" && request.url === "/api/v1/admin/tags?page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, name: "Tecnologia", slug: "tecnologia", postCount: 2 }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "POST" && request.url === "/api/v1/admin/tags") { response.statusCode = 201; return response.end(JSON.stringify({ id: postId, name: JSON.parse(body).name, slug: "nova-tag" })); }
    if (request.method === "PATCH" && request.url === `/api/v1/admin/tags/${postId}`) { response.statusCode = 200; return response.end(JSON.stringify({ id: postId, name: JSON.parse(body).name, slug: "tag-editada" })); }
    if (request.method === "DELETE" && request.url === `/api/v1/admin/tags/${postId}`) { response.statusCode = 200; return response.end(JSON.stringify({ deleted: true })); }
    if (request.method === "POST" && request.url === `/api/v1/admin/tags/${postId}/merge`) { response.statusCode = 201; return response.end(JSON.stringify({ merged: true, targetId: JSON.parse(body).targetId })); }
    if (["POST", "PATCH", "DELETE"].includes(request.method) && (request.url === "/api/v1/categories" || request.url === `/api/v1/categories/${postId}`)) { if (["conflict", "limited"].includes(categoryMode)) { response.statusCode = categoryMode === "conflict" ? 409 : 429; return response.end("{}"); } const payload = body ? JSON.parse(body) : null; categoryChanges.push({ method: request.method, body: payload }); if (categoryMode === "lost") { request.socket.destroy(); return; } response.statusCode = request.method === "DELETE" ? 204 : request.method === "POST" ? 201 : 200; return response.end(request.method === "DELETE" ? "" : JSON.stringify(categoryMode === "invalid" ? { id: postId, name: "Outro", isActive: true } : { id: postId, name: payload.name, description: payload.description, isActive: true })); }
    if (request.method === "GET" && request.url === "/api/v1/reports?status=PENDING&page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, postId, commentId: null, status: "PENDING", reason: "Motivo <script>privado</script>" }, { id: postId, postId: null, commentId: null, userId: postId, status: "PENDING", reason: "Perfil sintético" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: reportMode === "pages" } }));
    if (request.method === "GET" && request.url === "/api/v1/reports?status=PENDING&page=2&limit=20") return response.end(JSON.stringify({ data: [], meta: { page: 2, hasPreviousPage: true, hasNextPage: false } }));
    if (request.method === "GET" && request.url === "/api/v1/reports?status=IN_REVIEW&target=USER&page=1&limit=20") return response.end(JSON.stringify({ data: [{ id: postId, postId: null, commentId: null, userId: postId, status: "IN_REVIEW", reason: "Perfil em análise" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: true } }));
    if (request.method === "GET" && request.url === `/api/v1/reports/${postId}`) return response.end(JSON.stringify({ id: postId, reason: "Motivo <script>privado</script>", reasonCategory: "OTHER", description: "Descrição sintética", status: "IN_REVIEW", moderatorId: postId, moderationNote: null, createdAt: "2026-01-01T12:00:00.000Z", target: { type: "POST", id: postId, title: "Artigo sintético", content: "<p>Contexto sintético</p><script>alert(1)</script>" } }));
    if (request.method === "GET" && request.url === `/api/v1/reports/${postId}/history?page=1&limit=10`) return response.end(JSON.stringify({ data: [{ id: postId, actorId: postId, action: "report.assign", createdAt: "2026-01-01T12:00:00.000Z" }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } }));
    if (request.method === "PATCH" && request.url === `/api/v1/reports/${postId}/assign`) { const payload = JSON.parse(body); response.statusCode = 200; return response.end(JSON.stringify({ id: postId, status: payload.release ? "PENDING" : "IN_REVIEW", moderatorId: payload.release ? null : payload.moderatorId ?? actorId })); }
    if (request.method === "POST" && request.url === `/api/v1/reports/${postId}/resolve`) { const payload = JSON.parse(body); reportActions.push(payload); response.statusCode = 201; return response.end(JSON.stringify({ id: postId, status: payload.status, action: payload.action })); }
    if (request.method === "PATCH" && request.url === `/api/v1/reports/${postId}`) { if (["conflict", "invalid", "limited"].includes(reportMode)) { response.statusCode = { conflict: 409, invalid: 400, limited: 429 }[reportMode]; return response.end("{}"); } const input = JSON.parse(body); reportDecisions.push(input); return response.end(JSON.stringify({ id: postId, status: reportMode === "wrong-status" ? "PENDING" : input.status })); }
    if (request.method === "POST" && request.url === `/api/v1/post-reviews/${postId}/decision`) { const payload = JSON.parse(body); const decision = payload.decision; decisionBodies.push(payload); decisions.push(decision); response.statusCode = 201; return response.end(JSON.stringify({ status: invalidDecision ? "PENDING" : decision })); }
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
  const app = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: frontDir,
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
    return form("/gestao-editorial/entrar/sessao", { csrf, email: "fixture@example.test", password: role }, loginCookie.split(";")[0]);
  };

  const redirectsToLogin = async (path, init = {}) => { const result = await request(path, init); assert.equal(result.status, 307, path); assert.equal(new URL(result.headers.get("location"), base).pathname, "/gestao-editorial/entrar", path); };
  for (const path of ["", "/denuncias", "/artigos", "/comentarios", "/usuarios", "/administradores", "/categorias", "/tags", "/estatisticas", "/auditoria", "/conta"]) await redirectsToLogin("/gestao-editorial" + path);
  let response = await request("/admin");
  assert.equal(response.status, 404);
  const entry = await request("/gestao-editorial/entrar"); const entryHtml = await entry.text();
  assert.equal(entry.status, 200); assert.match(entryHtml, /Entrada administrativa/); assert.match(entryHtml, /name="totpCode"/);
  assert.match(entryHtml, /<meta name="robots" content="noindex/);
  assert.doesNotMatch(entryHtml, /Meus artigos|Artigos salvos|Autores seguidos|href="\/studio|href="\/conta|href="\/configuracoes|href="\/cadastro/);
  for (const path of ["/gestao-editorial/categorias/acao", "/gestao-editorial/tags/acao"]) assert.ok([401, 403].includes((await form(path, { csrf: "x" }, "")).status), path);
  assert.equal((await form("/gestao-editorial/sair", { csrf: "x" }, "")).status, 303);
  response = await request("/gestao-editorial/auditoria?actorId=invalido");
  assert.doesNotMatch(await response.text(), /Ações registradas|Filtros inválidos/);
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
  assert.equal(response.status, 200); assert.match(html, /Contas cadastradas/); assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /Administra/); assert.match(html, />ADMIN</); assert.match(html, /Sair da administra/);
  assert.doesNotMatch(html, /Meus artigos|Artigos salvos|Autores seguidos|href="\/studio|href="\/conta|href="\/configuracoes|Voltar ao blog/);
  assert.doesNotMatch(html, /href="\/gestao-editorial\/administradores"/);
  assert.doesNotMatch(html, /<script[^>]*>[^<]*alert|<img|onerror/i);
  const csrf = csrfFrom(html);
  assert.equal((await form("/gestao-editorial/atividade", { csrf }, sessionCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/atividade", { csrf: "invalid" }, sessionCookie)).status, 403);
  assert.equal((await form("/gestao-editorial/atividade", { csrf }, sessionCookie, "https://evil.example.test")).status, 403);
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.match(await response.text(), /Contas cadastradas/); assert.match(response.headers.get("cache-control"), /private|no-store/);
  response = await request("/gestao-editorial/newsletter", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.match(await response.text(), /Inscrições e entregas/);
  response = await request("/gestao-editorial/estatisticas", { headers: { Cookie: sessionCookie } });
  const activity = await response.text();
  assert.equal(response.status, 200); assert.match(activity, /Denúncia analisada/); assert.match(activity, /Artigo &lt;sintético&gt;/); assert.doesNotMatch(activity, /Artigo <sintético>/);
  response = await request("/gestao-editorial/auditoria?action=report.review", { headers: { Cookie: sessionCookie } });
  const audit = await response.text();
  assert.equal(response.status, 200); assert.match(audit, /Motivo &lt;sintético&gt;/); assert.doesNotMatch(audit, /Motivo <sintético>/);
  assert.match(audit, /Denúncia analisada/); assert.match(audit, /Moderadora sintética/); assert.match(audit, /Conteúdo sintético/); assert.match(audit, /Detalhes técnicos/);
  const removedAudit = await (await request("/gestao-editorial/auditoria?search=removido", { headers: { Cookie: sessionCookie } })).text();
  assert.match(removedAudit, /Usuário indisponível/); assert.match(removedAudit, /Detalhes não disponíveis/);
  response = await request("/gestao-editorial/auditoria?from=2026-01-01&to=2026-01-31", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200);
  const auditQuery = new URL(auditQueries.at(-1), "http://localhost").searchParams;
  assert.equal(auditQuery.get("from"), "2026-01-01T00:00:00.000Z"); assert.equal(auditQuery.get("to"), "2026-01-31T23:59:59.999Z");
  response = await request("/gestao-editorial/auditoria?from=2026-02-30", { headers: { Cookie: sessionCookie } });
  assert.match(await response.text(), /Filtros inválidos/);
  response = await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } });
  const reactReports = await response.text();
  assert.equal(response.status, 200); assert.match(reactReports, /Central de denúncias/); assert.match(reactReports, /Motivo &lt;script&gt;privado/); assert.doesNotMatch(reactReports, /<script>privado/);
  response = await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } });
  const reactUsers = await response.text();
  assert.equal(response.status, 200); assert.match(reactUsers, /Pessoa &lt;teste&gt;/); assert.match(reactUsers, /SUPER_ADMIN/);
  response = await request("/gestao-editorial/comentarios", { headers: { Cookie: sessionCookie } });
  const comments = await response.text();
  assert.equal(response.status, 200); assert.match(comments, /Comentário &lt;sintético&gt;/); assert.doesNotMatch(comments, /Comentário <sintético>/);
  response = await request(`/gestao-editorial/comentarios/${postId}`, { headers: { Cookie: sessionCookie } });
  const commentDetail = await response.text();
  assert.equal(response.status, 200); assert.match(commentDetail, /Motivo &lt;privado&gt;/); assert.match(commentDetail, /Decisão sintética/); assert.doesNotMatch(commentDetail, /Motivo <privado>/);
  response = await request("/gestao-editorial/artigos", { headers: { Cookie: sessionCookie } });
  assert.match(await response.text(), /Artigo &lt;privado&gt;/);
  response = await request(`/gestao-editorial/artigos/${postId}`, { headers: { Cookie: sessionCookie } });
  const postDetail = await response.text();
  assert.match(postDetail, /Conteúdo privado/); assert.match(postDetail, /Decisão editorial/); assert.doesNotMatch(postDetail, /<script>alert\(1\)/);
  assert.equal((await form(`/gestao-editorial/artigos/${postId}/moderar`, { csrf, action: "hide", reason: "Motivo sintético" }, sessionCookie)).status, 204);
  const reviewAction = { csrf, decision: "REJECTED", reason: "Justificativa sintética" };
  assert.equal((await form(`/gestao-editorial/artigos/${postId}/revisar`, reviewAction, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(`/gestao-editorial/artigos/${postId}/revisar`, { ...reviewAction, reason: " x " }, sessionCookie)).status, 400);
  assert.equal((await form(`/gestao-editorial/artigos/${postId}/revisar`, reviewAction, sessionCookie)).status, 204);
  assert.deepEqual(decisionBodies.at(-1), { decision: "REJECTED", reason: "Justificativa sintética" });
  decisions.pop();
  const commentAction = { csrf, action: "hide", reason: "Motivo sintético" };
  assert.equal((await form(`/gestao-editorial/comentarios/${postId}/moderar`, commentAction, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(`/gestao-editorial/comentarios/${postId}/moderar`, { ...commentAction, reason: "x" }, sessionCookie)).status, 400);
  assert.deepEqual(commentActions, []);
  assert.equal((await form(`/gestao-editorial/comentarios/${postId}/moderar`, commentAction, sessionCookie)).status, 204);
  assert.deepEqual(commentActions, [{ reason: "Motivo sintético" }]);
  commentMode = "wrong";
  assert.equal((await form(`/gestao-editorial/comentarios/${postId}/moderar`, commentAction, sessionCookie)).status, 503);
  assert.equal(commentActions.length, 2);
  commentMode = "ok";
  // O ADMIN não vê nem acessa o gerenciamento exclusivo de cargos.
  response = await request(`/gestao-editorial/usuarios/${postId}`, { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.doesNotMatch(await response.text(), /Gerenciar função/);
  response = await request("/gestao-editorial/administradores", { headers: { Cookie: sessionCookie } });
  const forbiddenAdmins = await response.text(); assert.match(forbiddenAdmins, /Acesso negado/); assert.doesNotMatch(forbiddenAdmins, /Administradores ativos|Promover usuário/);
  response = await request(`/gestao-editorial/usuarios/${postId}/funcao`, { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Nova função/);
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/funcao/alterar`, { csrf, role: "ADMIN", reason: "Justificativa sintética", code: "123456" }, sessionCookie)).status, 403);
  assert.deepEqual(roleChanges, []);

  const adminToken = [...roles.entries()].find(([, role]) => role === "ADMIN")[0];
  roles.set(adminToken, "AUTHOR");
  response = await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Central de denúncias/);
  response = await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Pessoa &lt;teste&gt;/);
  response = await request("/gestao-editorial/comentarios", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Comentário &lt;sintético&gt;/);
  response = await request(`/gestao-editorial/comentarios/${postId}`, { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Decisão sintética/);
  response = await request(`/gestao-editorial/artigos/${postId}`, { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Conteúdo privado/);
  assert.equal((await form(`/gestao-editorial/artigos/${postId}/moderar`, { csrf, action: "hide", reason: "Motivo sintético" }, sessionCookie)).status, 401);
  assert.equal((await form(`/gestao-editorial/artigos/${postId}/revisar`, { csrf, decision: "APPROVED", reason: "" }, sessionCookie)).status, 401);
  assert.equal((await form(`/gestao-editorial/comentarios/${postId}/moderar`, commentAction, sessionCookie)).status, 401);
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Contas cadastradas/);
  // Cargo rebaixado: a mesma sessão perde o acesso ao painel inteiro e é levada à entrada.
  await redirectsToLogin("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  for (const path of ["/denuncias", "/artigos", "/comentarios", "/usuarios", "/categorias", "/tags", "/estatisticas", "/auditoria", "/conta"]) await redirectsToLogin("/gestao-editorial" + path, { headers: { Cookie: sessionCookie } });
  for (const [path, body] of [["/gestao-editorial/categorias/acao", { csrf, action: "create", name: "Categoria sintética", description: "Teste" }], ["/gestao-editorial/denuncias/" + postId + "/resolver", { csrf, status: "RESOLVED", action: "HIDE_POST", note: "Violação confirmada" }]]) assert.equal((await form(path, body, sessionCookie)).status, 401);
  roles.set(adminToken, "ADMIN");
  revoked.add(adminToken);
  response = await request("/gestao-editorial/newsletter", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Inscrições e entregas/);
  await redirectsToLogin("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  await redirectsToLogin("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } });
  assert.equal((await form("/gestao-editorial/categorias/acao", { csrf, action: "create", name: "Categoria sintética", description: "Teste" }, sessionCookie)).status, 401);
  assert.deepEqual(decisions, []);

  response = await login("ADMIN");
  assert.equal(response.status, 303);
  const nextCookie = findCookie(response, "__Host-editorial-session").split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: nextCookie } });
  const nextCsrf = csrfFrom(await response.text());
  assert.equal((await form("/gestao-editorial/sair", { csrf: "invalid" }, nextCookie)).status, 403);
  response = await form("/gestao-editorial/sair", { csrf: nextCsrf }, nextCookie, "https://outside.example.test");
  assert.equal(response.status, 403);
  response = await form("/gestao-editorial/sair", { csrf: nextCsrf }, nextCookie);
  assert.equal(response.status, 303); assert.equal(new URL(response.headers.get("location"), base).pathname, "/gestao-editorial/entrar");
  assert.match(findCookie(response, "__Host-editorial-session"), /Max-Age=0/i);
  await redirectsToLogin("/gestao-editorial", { headers: { Cookie: nextCookie } });
  userSuspended = false;
  response = await login("SUPER_ADMIN");
  assert.equal(response.status, 303);
  const superCookie = findCookie(response, "__Host-editorial-session").split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: superCookie } });
  const superCsrf = csrfFrom(await response.text());
  response = await request(`/gestao-editorial/usuarios/${postId}/funcao`, { headers: { Cookie: superCookie } });
  assert.match(await response.text(), /Nova função/);
  const roleChange = { csrf: superCsrf, role: "ADMIN", reason: "Justificativa sintética", code: "123456" };
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/funcao/alterar`, roleChange, superCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/funcao/alterar`, { ...roleChange, code: "000000" }, superCookie)).status, 401);
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/funcao/alterar`, roleChange, superCookie)).status, 204);
  assert.deepEqual(roleChanges, [{ role: "ADMIN", reason: "Justificativa sintética" }]);

  response = await request("/gestao-editorial/categorias", { headers: { Cookie: superCookie } });
  const reactCats = await response.text();
  assert.equal(response.status, 200);
  assert.match(reactCats, /Categoria &lt;teste&gt;/);
  assert.match(reactCats, /categoria-teste/);
  assert.equal((await form("/gestao-editorial/categorias/acao", { csrf: superCsrf, action: "create", name: "Nova Categoria", description: "Descrição" }, superCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/categorias/acao", { csrf: superCsrf, action: "edit", id: postId, name: "Categoria Renomeada", slug: "categoria-renomeada", description: "Nova desc" }, superCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/categorias/acao", { csrf: superCsrf, action: "delete", id: postId }, superCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/categorias/acao", { csrf: superCsrf, action: "reactivate", id: postId }, superCookie)).status, 204);

  response = await request("/gestao-editorial/tags", { headers: { Cookie: superCookie } });
  const reactTags = await response.text();
  assert.equal(response.status, 200);
  assert.match(reactTags, /Tecnologia/);
  assert.equal((await form("/gestao-editorial/tags/acao", { csrf: superCsrf, action: "create", name: "Novíssima Tag" }, superCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/tags/acao", { csrf: superCsrf, action: "edit", id: postId, name: "Tag Atualizada" }, superCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/tags/acao", { csrf: superCsrf, action: "merge", id: postId, targetId: actorId }, superCookie)).status, 204);
  assert.equal((await form("/gestao-editorial/tags/acao", { csrf: superCsrf, action: "delete", id: postId }, superCookie)).status, 204);

  response = await request(`/gestao-editorial/denuncias/${postId}`, { headers: { Cookie: superCookie } });
  const reportDetailReact = await response.text();
  assert.equal(response.status, 200);
  assert.match(reportDetailReact, /Contexto sintético/);
  assert.match(reportDetailReact, /Motivo &lt;script&gt;privado/);
  assert.equal((await form(`/gestao-editorial/denuncias/${postId}/atribuir`, { csrf: superCsrf, moderatorId: "inválido" }, superCookie)).status, 400);
  assert.equal((await form(`/gestao-editorial/denuncias/${postId}/atribuir`, { csrf: superCsrf }, superCookie)).status, 204);
  assert.equal((await form(`/gestao-editorial/denuncias/${postId}/atribuir`, { csrf: superCsrf, release: "true" }, superCookie)).status, 204);
  assert.equal((await form(`/gestao-editorial/denuncias/${postId}/resolver`, { csrf: superCsrf, status: "RESOLVED", action: "HIDE_POST", note: "Violação confirmada no teste" }, superCookie)).status, 204);

  response = await request(`/gestao-editorial/usuarios/${postId}`, { headers: { Cookie: superCookie } });
  const userDetailReact = await response.text();
  assert.equal(response.status, 200);
  assert.match(userDetailReact, /Pessoa &lt;teste&gt;/);
  assert.match(userDetailReact, /Artigos: 2/);
  response = await request(`/gestao-editorial/usuarios/${postId}/denuncias`, { headers: { Cookie: superCookie } });
  const userReportsReact = await response.text();
  assert.equal(response.status, 200);
  assert.match(userReportsReact, /Motivo &lt;teste&gt;/);
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/moderar`, { csrf: superCsrf, action: "revoke-sessions", reason: "Revogação preventiva" }, superCookie)).status, 204);
  assert.deepEqual(userActions.at(-1), { action: "revoke-sessions", body: { reason: "Revogação preventiva" } });
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/moderar`, { csrf: superCsrf, action: "suspend", reason: "Suspensão válida" }, superCookie)).status, 204);
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/moderar`, { csrf: superCsrf, action: "restore" }, superCookie)).status, 204);

  // Gerenciamento de Administradores: exclusivo do SUPER_ADMIN.
  response = await request("/gestao-editorial/administradores", { headers: { Cookie: superCookie } });
  const adminsHtml = await response.text();
  assert.equal(response.status, 200);
  assert.match(adminsHtml, /Gerenciamento de Administradores/); assert.match(adminsHtml, /Situação/);
  assert.match(adminsHtml, /Dona &lt;Raiz&gt;/); assert.match(adminsHtml, /Moderadora &lt;Teste&gt;/); assert.doesNotMatch(adminsHtml, /Dona <Raiz>/);
  assert.match(adminsHtml, /Remover cargo ADMIN/); assert.match(adminsHtml, /Concessão &lt;sintética&gt;/); assert.doesNotMatch(adminsHtml, /Concessão <sintética>/);
  assert.match(adminsHtml, /READER[^A-Z]*ADMIN/); assert.match(adminsHtml, /href="\/gestao-editorial\/administradores"/);
  assert.doesNotMatch(adminsHtml, /Meus artigos|Artigos salvos|Autores seguidos|href="\/conta|href="\/configuracoes|Voltar ao blog/);
  response = await request("/gestao-editorial/administradores?busca=Pessoa", { headers: { Cookie: superCookie } });
  const candidatesHtml = await response.text();
  assert.equal(response.status, 200); assert.match(candidatesHtml, new RegExp(`/gestao-editorial/usuarios/${postId}/funcao\\?cargo=ADMIN`));
  assert.doesNotMatch(candidatesHtml, /c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11\/funcao\?cargo=ADMIN/);
  assert.equal((await request("/gestao-editorial/administradores?busca=a&busca=b", { headers: { Cookie: superCookie } })).status, 200);
  response = await request(`/gestao-editorial/usuarios/${postId}/funcao?cargo=ADMIN`, { headers: { Cookie: superCookie } });
  assert.match(await response.text(), /<option value="ADMIN" selected/);
  response = await request("/gestao-editorial/conta", { headers: { Cookie: superCookie } });
  const accountHtml = await response.text();
  assert.equal(response.status, 200); assert.match(accountHtml, /SUPER_ADMIN/); assert.match(accountHtml, /Sessão administrativa válida até/); assert.match(accountHtml, /Sair da administra/);
  assert.doesNotMatch(accountHtml, /Meus artigos|Artigos salvos|Autores seguidos/);
  // 7 & 8: O novo ADMIN consegue autenticar e acessar o painel.
  roles.set(`promoted-token`, "ADMIN");
  const promotedLogin = await login("ADMIN");
  assert.equal(promotedLogin.status, 303);
  const promotedCookie = findCookie(promotedLogin, "__Host-editorial-session").split(";")[0];
  const promotedPanel = await request("/gestao-editorial", { headers: { Cookie: promotedCookie } });
  assert.equal(promotedPanel.status, 200);
  assert.match(await promotedPanel.text(), /Contas cadastradas/);

  // 9: SUPER_ADMIN revoga o cargo de ADMIN.
  assert.equal((await form(`/gestao-editorial/usuarios/${postId}/funcao/alterar`, { csrf: superCsrf, role: "READER", reason: "Revogação sintética", code: "123456" }, superCookie)).status, 204);
  assert.deepEqual(roleChanges.at(-1), { role: "READER", reason: "Revogação sintética" });

  // 10: O usuário rebaixado perde acesso administrativo, inclusive com sua sessão anterior.
  for (const [k, v] of roles) if (v === "ADMIN") roles.set(k, "READER");
  await redirectsToLogin("/gestao-editorial", { headers: { Cookie: promotedCookie } });
  await redirectsToLogin("/gestao-editorial/denuncias", { headers: { Cookie: promotedCookie } });
});
