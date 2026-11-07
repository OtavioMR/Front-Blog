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
  for (const path of ["/admin", "/admin/newsletter", "/admin/analytics", "/admin/audit-logs", "/admin/reports", "/admin/users", "/admin/categories", "/admin/tags", "/gestao-editorial", "/gestao-editorial/entrar", "/gestao-editorial/denuncias", "/gestao-editorial/categorias", "/gestao-editorial/indicadores", "/gestao-editorial/usuarios"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
    if (!path.startsWith("/admin") && !path.endsWith("indicadores") && !path.endsWith("usuarios")) assert.equal((await fetch(base + path, { method: "POST" })).status, 404, path);
  }
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
    if (request.method === "GET" && request.url.startsWith("/api/v1/admin/audit-logs?")) { auditQueries.push(request.url); return response.end(JSON.stringify({ data: [{ id: postId, actorId: postId, action: "report.review", targetType: "report", targetId: postId, createdAt: "2026-01-01T12:00:00.000Z", details: { reason: "Motivo <sintético>" } }], meta: { page: 1, hasPreviousPage: false, hasNextPage: false } })); }
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
    if (request.method === "PATCH" && request.url === `/api/v1/reports/${postId}/assign`) { const payload = JSON.parse(body); response.statusCode = 200; return response.end(JSON.stringify({ id: postId, status: "IN_REVIEW", moderatorId: payload.moderatorId })); }
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
    return form("/gestao-editorial/entrar", { csrf, email: "fixture@example.test", password: role }, loginCookie.split(";")[0]);
  };

  let response = await request("/gestao-editorial");
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await request("/gestao-editorial/denuncias")).status, 401);
  assert.equal((await request("/gestao-editorial/indicadores")).status, 401);
  assert.equal((await request("/gestao-editorial/categorias")).status, 401);
  assert.equal((await request("/gestao-editorial/usuarios")).status, 401);
  response = await request("/admin");
  assert.doesNotMatch(await response.text(), /Contas cadastradas/);
  response = await request("/admin/audit-logs?actorId=invalido");
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
  assert.equal(response.status, 200); assert.match(html, new RegExp(privateText));
  assert.doesNotMatch(html, /<script|<img|onerror/i); assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "same-origin");
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  const csrf = csrfFrom(html);
  response = await request("/admin", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.match(await response.text(), /Contas cadastradas/); assert.match(response.headers.get("cache-control"), /private|no-store/);
  response = await request("/admin/newsletter", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200); assert.match(await response.text(), /Inscrições e entregas/);
  response = await request("/admin/analytics", { headers: { Cookie: sessionCookie } });
  const activity = await response.text();
  assert.equal(response.status, 200); assert.match(activity, /report.review/); assert.match(activity, /Artigo &lt;sintético&gt;/); assert.doesNotMatch(activity, /Artigo <sintético>/);
  response = await request("/admin/audit-logs?action=report.review", { headers: { Cookie: sessionCookie } });
  const audit = await response.text();
  assert.equal(response.status, 200); assert.match(audit, /Motivo &lt;sintético&gt;/); assert.doesNotMatch(audit, /Motivo <sintético>/);
  response = await request("/admin/audit-logs?from=2026-01-01&to=2026-01-31", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200);
  const auditQuery = new URL(auditQueries.at(-1), "http://localhost").searchParams;
  assert.equal(auditQuery.get("from"), "2026-01-01T00:00:00.000Z"); assert.equal(auditQuery.get("to"), "2026-01-31T23:59:59.999Z");
  response = await request("/admin/audit-logs?from=2026-02-30", { headers: { Cookie: sessionCookie } });
  assert.match(await response.text(), /Filtros inválidos/);
  response = await request("/admin/reports", { headers: { Cookie: sessionCookie } });
  const reactReports = await response.text();
  assert.equal(response.status, 200); assert.match(reactReports, /Central de denúncias/); assert.match(reactReports, /Motivo &lt;script&gt;privado/); assert.doesNotMatch(reactReports, /<script>privado/);
  response = await request("/admin/users", { headers: { Cookie: sessionCookie } });
  const reactUsers = await response.text();
  assert.equal(response.status, 200); assert.match(reactUsers, /Pessoa &lt;teste&gt;/); assert.match(reactUsers, /SUPER_ADMIN/);
  response = await request("/admin/comments", { headers: { Cookie: sessionCookie } });
  const comments = await response.text();
  assert.equal(response.status, 200); assert.match(comments, /Comentário &lt;sintético&gt;/); assert.doesNotMatch(comments, /Comentário <sintético>/);
  response = await request(`/admin/comments/${postId}`, { headers: { Cookie: sessionCookie } });
  const commentDetail = await response.text();
  assert.equal(response.status, 200); assert.match(commentDetail, /Motivo &lt;privado&gt;/); assert.match(commentDetail, /Decisão sintética/); assert.doesNotMatch(commentDetail, /Motivo <privado>/);
  response = await request("/admin/posts", { headers: { Cookie: sessionCookie } });
  assert.match(await response.text(), /Artigo &lt;privado&gt;/);
  response = await request(`/admin/posts/${postId}`, { headers: { Cookie: sessionCookie } });
  const postDetail = await response.text();
  assert.match(postDetail, /Conteúdo privado/); assert.match(postDetail, /Decisão editorial/); assert.doesNotMatch(postDetail, /<script>alert\(1\)/);
  assert.equal((await form(`/admin/posts/${postId}/moderate`, { csrf, action: "hide", reason: "Motivo sintético" }, sessionCookie)).status, 204);
  const reviewAction = { csrf, decision: "REJECTED", reason: "Justificativa sintética" };
  assert.equal((await form(`/admin/posts/${postId}/review`, reviewAction, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(`/admin/posts/${postId}/review`, { ...reviewAction, reason: " x " }, sessionCookie)).status, 400);
  assert.equal((await form(`/admin/posts/${postId}/review`, reviewAction, sessionCookie)).status, 204);
  assert.deepEqual(decisionBodies.at(-1), { decision: "REJECTED", reason: "Justificativa sintética" });
  decisions.pop();
  const commentAction = { csrf, action: "hide", reason: "Motivo sintético" };
  assert.equal((await form(`/admin/comments/${postId}/moderate`, commentAction, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(`/admin/comments/${postId}/moderate`, { ...commentAction, reason: "x" }, sessionCookie)).status, 400);
  assert.deepEqual(commentActions, []);
  assert.equal((await form(`/admin/comments/${postId}/moderate`, commentAction, sessionCookie)).status, 204);
  assert.deepEqual(commentActions, [{ reason: "Motivo sintético" }]);
  commentMode = "wrong";
  assert.equal((await form(`/admin/comments/${postId}/moderate`, commentAction, sessionCookie)).status, 503);
  assert.equal(commentActions.length, 2);
  commentMode = "ok";
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
  response = await request("/gestao-editorial/usuarios?search=Pessoa&status=suspended", { headers: { Cookie: sessionCookie } });
  const filteredUsers = await response.text();
  assert.equal(response.status, 200); assert.match(filteredUsers, /Suspenso/); assert.match(filteredUsers, /search=Pessoa&amp;status=suspended/);
  response = await request(`/gestao-editorial/usuarios/${postId}`, { headers: { Cookie: sessionCookie } });
  const userDetail = await response.text();
  assert.equal(response.status, 200); assert.match(userDetail, /user.suspend/); assert.match(userDetail, /Artigos: 2/); assert.doesNotMatch(userDetail, /Pessoa <teste>/);
  assert.doesNotMatch(userDetail, /Gerenciar função/);
  response = await request(`/admin/users/${postId}/role`, { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Nova função/);
  assert.equal((await form(`/admin/users/${postId}/role/change`, { csrf, role: "ADMIN", reason: "Justificativa sintética", code: "123456" }, sessionCookie)).status, 403);
  response = await request(`/gestao-editorial/usuarios/${postId}/denuncias`, { headers: { Cookie: sessionCookie } });
  const userReports = await response.text();
  assert.equal(response.status, 200); assert.match(userReports, /Motivo &lt;teste&gt;/); assert.doesNotMatch(userReports, /não exibir/);
  const userPath = `/gestao-editorial/usuarios/${postId}`;
  const restore = { csrf, step: "confirm", action: "restore" };
  assert.equal((await form(userPath, { ...restore, step: "execute" }, sessionCookie)).status, 400);
  response = await form(userPath, restore, sessionCookie);
  assert.equal(response.status, 200);
  const restoreHtml = await response.text();
  const restoreTimestamp = restoreHtml.match(/name="timestamp" value="([^"]+)"/)[1];
  const restoreNonce = restoreHtml.match(/name="nonce" value="([^"]+)"/)[1];
  const restoreSignature = restoreHtml.match(/name="signature" value="([^"]+)"/)[1];
  assert.equal((await form(userPath, { ...restore, step: "execute", timestamp: restoreTimestamp, nonce: restoreNonce, signature: restoreSignature }, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(userPath, { ...restore, action: "suspend", reason: "Motivo sintético", step: "execute", timestamp: restoreTimestamp, nonce: restoreNonce, signature: restoreSignature }, sessionCookie)).status, 400);
  assert.deepEqual(userActions, []);
  assert.equal((await form(userPath, { ...restore, step: "execute", timestamp: restoreTimestamp, nonce: restoreNonce, signature: restoreSignature }, sessionCookie)).status, 303);
  assert.equal((await form(userPath, { ...restore, step: "execute", timestamp: restoreTimestamp, nonce: restoreNonce, signature: restoreSignature }, sessionCookie)).status, 400);
  assert.deepEqual(userActions, [{ action: "restore", body: {} }]);
  const suspend = { csrf, step: "confirm", action: "suspend", reason: "Motivo sintético", endsAt: "" };
  assert.equal((await form(userPath, { ...suspend, reason: " x " }, sessionCookie)).status, 400);
  response = await form(userPath, suspend, sessionCookie);
  assert.equal(response.status, 200);
  const suspendHtml = await response.text();
  const suspendTimestamp = suspendHtml.match(/name="timestamp" value="([^"]+)"/)[1];
  const suspendNonce = suspendHtml.match(/name="nonce" value="([^"]+)"/)[1];
  const suspendSignature = suspendHtml.match(/name="signature" value="([^"]+)"/)[1];
  const executeSuspend = { ...suspend, step: "execute", timestamp: suspendTimestamp, nonce: suspendNonce, signature: suspendSignature };
  userActionMode = "conflict";
  assert.equal((await form(userPath, executeSuspend, sessionCookie)).status, 409);
  assert.equal(userActions.length, 1);
  userActionMode = "lost";
  response = await form(userPath, suspend, sessionCookie);
  const secondSuspendHtml = await response.text();
  response = await form(userPath, { ...suspend, step: "execute", timestamp: secondSuspendHtml.match(/name="timestamp" value="([^"]+)"/)[1], nonce: secondSuspendHtml.match(/name="nonce" value="([^"]+)"/)[1], signature: secondSuspendHtml.match(/name="signature" value="([^"]+)"/)[1] }, sessionCookie);
  assert.equal(response.status, 503); assert.match(await response.text(), /Resultado incerto/);
  assert.deepEqual(userActions.at(-1), { action: "suspend", body: { reason: "Motivo sintético" } });
  userActionMode = "ok";
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
  assert.equal((await form("/gestao-editorial", { ...decision, decision: "REJECTED", reason: "  x  " }, sessionCookie)).status, 400);
  assert.equal((await form("/gestao-editorial", { ...decision, decision: "REJECTED", reason: "  Justificativa sintética  " }, sessionCookie)).status, 303);
  assert.deepEqual(decisionBodies.at(-1), { decision: "REJECTED", reason: "Justificativa sintética" });
  decisions.pop();
  invalidDecision = true;
  response = await form("/gestao-editorial", decision, sessionCookie);
  assert.equal(response.status, 503); assert.match(await response.text(), /Confira a fila antes de tentar novamente/);
  assert.deepEqual(decisions, ["APPROVED", "APPROVED"]);
  decisions.pop();
  invalidDecision = false;

  response = await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } });
  const reportsHtml = await response.text();
  assert.equal(response.status, 200); assert.match(reportsHtml, /Motivo &lt;script&gt;privado/); assert.doesNotMatch(reportsHtml, /<script>/);
  assert.match(reportsHtml, /Perfil: a0eebc99/);
  response = await request("/gestao-editorial/denuncias?status=IN_REVIEW&target=USER", { headers: { Cookie: sessionCookie } });
  const filteredReports = await response.text();
  assert.equal(response.status, 200); assert.match(filteredReports, /Perfil em análise/); assert.match(filteredReports, /page=2&amp;status=IN_REVIEW&amp;target=USER/);
  assert.equal((await request("/gestao-editorial/denuncias?status=PENDING&status=RESOLVED", { headers: { Cookie: sessionCookie } })).status, 400);
  response = await request(`/gestao-editorial/denuncias/${postId}`, { headers: { Cookie: sessionCookie } });
  const reportDetail = await response.text();
  assert.equal(response.status, 200); assert.match(reportDetail, /Contexto sintético/); assert.match(reportDetail, /report.assign/); assert.doesNotMatch(reportDetail, /<script>/); assert.match(response.headers.get("cache-control"), /no-store/);
  const actionForm = { csrf, step: "confirm", decision: "RESOLVED", action: "HIDE_POST", note: "Violação sintética" };
  const detailPath = `/gestao-editorial/denuncias/${postId}`;
  assert.equal((await form(detailPath, { ...actionForm, step: "execute" }, sessionCookie)).status, 400);
  assert.equal((await form(detailPath, { ...actionForm, decision: "DISMISSED" }, sessionCookie)).status, 400);
  response = await form(detailPath, actionForm, sessionCookie);
  assert.equal(response.status, 200);
  const confirmHtml = await response.text();
  const timestamp = confirmHtml.match(/name="timestamp" value="([^"]+)"/)[1];
  const nonce = confirmHtml.match(/name="nonce" value="([^"]+)"/)[1];
  const signature = confirmHtml.match(/name="signature" value="([^"]+)"/)[1];
  assert.equal((await form(detailPath, { ...actionForm, step: "execute", timestamp, nonce, signature, note: "Justificativa alterada" }, sessionCookie)).status, 400);
  assert.deepEqual(reportActions, []);
  assert.equal((await form(detailPath, { ...actionForm, step: "execute", timestamp, nonce, signature }, sessionCookie)).status, 303);
  assert.equal((await form(detailPath, { ...actionForm, step: "execute", timestamp, nonce, signature }, sessionCookie)).status, 400);
  assert.deepEqual(reportActions, [{ status: "RESOLVED", action: "HIDE_POST", note: "Violação sintética" }]);
  assert.match(response.headers.get("cache-control"), /no-store/); assert.match(response.headers.get("x-robots-tag"), /noindex/);
  const reportDecision = { csrf, id: postId, decision: "RESOLVED", note: "Análise sintética" };
  assert.equal((await form("/gestao-editorial/denuncias", reportDecision, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form("/gestao-editorial/denuncias", { ...reportDecision, csrf: "invalid" }, sessionCookie)).status, 403);
  assert.equal((await form("/gestao-editorial/denuncias", { ...reportDecision, decision: "PENDING" }, sessionCookie)).status, 400);
  assert.equal((await form("/gestao-editorial/denuncias", { ...reportDecision, note: "   " }, sessionCookie)).status, 400);
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
  response = await request("/admin/reports", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Central de denúncias/);
  response = await request("/admin/users", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Pessoa &lt;teste&gt;/);
  response = await request("/admin/comments", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Comentário &lt;sintético&gt;/);
  response = await request(`/admin/comments/${postId}`, { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Decisão sintética/);
  response = await request(`/admin/posts/${postId}`, { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Conteúdo privado/);
  assert.equal((await form(`/admin/posts/${postId}/moderate`, { csrf, action: "hide", reason: "Motivo sintético" }, sessionCookie)).status, 403);
  assert.equal((await form(`/admin/posts/${postId}/review`, { csrf, decision: "APPROVED", reason: "" }, sessionCookie)).status, 403);
  assert.equal((await form(`/admin/comments/${postId}/moderate`, commentAction, sessionCookie)).status, 403);
  response = await request("/admin", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Contas cadastradas/);
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 403);
  assert.equal((await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request(`/gestao-editorial/denuncias/${postId}`, { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request("/gestao-editorial/indicadores", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request("/gestao-editorial/categorias", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request(`/gestao-editorial/usuarios/${postId}`, { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await request(`/gestao-editorial/usuarios/${postId}/denuncias`, { headers: { Cookie: sessionCookie } })).status, 403);
  assert.equal((await form("/gestao-editorial/categorias", categoryCreate, sessionCookie)).status, 403);
  assert.equal((await form("/gestao-editorial/denuncias", reportDecision, sessionCookie)).status, 403);
  assert.deepEqual(decisions, ["APPROVED"]);
  roles.set(adminToken, "ADMIN");
  revoked.add(adminToken);
  response = await request("/admin/newsletter", { headers: { Cookie: sessionCookie } });
  assert.doesNotMatch(await response.text(), /Inscrições e entregas/);
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 401);
  assert.equal((await request("/gestao-editorial/denuncias", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request(`/gestao-editorial/denuncias/${postId}`, { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request("/gestao-editorial/indicadores", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request("/gestao-editorial/categorias", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request("/gestao-editorial/usuarios", { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request(`/gestao-editorial/usuarios/${postId}`, { headers: { Cookie: sessionCookie } })).status, 401);
  assert.equal((await request(`/gestao-editorial/usuarios/${postId}/denuncias`, { headers: { Cookie: sessionCookie } })).status, 401);
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
  userSuspended = false;
  response = await login("SUPER_ADMIN");
  assert.equal(response.status, 303);
  const superCookie = findCookie(response, "__Host-editorial-session").split(";")[0];
  response = await request("/gestao-editorial", { headers: { Cookie: superCookie } });
  const superCsrf = csrfFrom(await response.text());
  response = await request(`/admin/users/${postId}/role`, { headers: { Cookie: superCookie } });
  assert.match(await response.text(), /Nova função/);
  const roleChange = { csrf: superCsrf, role: "ADMIN", reason: "Justificativa sintética", code: "123456" };
  assert.equal((await form(`/admin/users/${postId}/role/change`, roleChange, superCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form(`/admin/users/${postId}/role/change`, { ...roleChange, code: "000000" }, superCookie)).status, 401);
  assert.equal((await form(`/admin/users/${postId}/role/change`, roleChange, superCookie)).status, 204);
  assert.deepEqual(roleChanges, [{ role: "ADMIN", reason: "Justificativa sintética" }]);

  response = await request("/admin/categories", { headers: { Cookie: superCookie } });
  const reactCats = await response.text();
  assert.equal(response.status, 200);
  assert.match(reactCats, /Categoria &lt;teste&gt;/);
  assert.match(reactCats, /categoria-teste/);
  assert.equal((await form("/admin/categories/action", { csrf: superCsrf, action: "create", name: "Nova Categoria", description: "Descrição" }, superCookie)).status, 204);
  assert.equal((await form("/admin/categories/action", { csrf: superCsrf, action: "edit", id: postId, name: "Categoria Renomeada", slug: "categoria-renomeada", description: "Nova desc" }, superCookie)).status, 204);
  assert.equal((await form("/admin/categories/action", { csrf: superCsrf, action: "delete", id: postId }, superCookie)).status, 204);
  assert.equal((await form("/admin/categories/action", { csrf: superCsrf, action: "reactivate", id: postId }, superCookie)).status, 204);

  response = await request("/admin/tags", { headers: { Cookie: superCookie } });
  const reactTags = await response.text();
  assert.equal(response.status, 200);
  assert.match(reactTags, /Tecnologia/);
  assert.equal((await form("/admin/tags/action", { csrf: superCsrf, action: "create", name: "Novíssima Tag" }, superCookie)).status, 204);
  assert.equal((await form("/admin/tags/action", { csrf: superCsrf, action: "edit", id: postId, name: "Tag Atualizada" }, superCookie)).status, 204);
  assert.equal((await form("/admin/tags/action", { csrf: superCsrf, action: "merge", id: postId, targetId: actorId }, superCookie)).status, 204);
  assert.equal((await form("/admin/tags/action", { csrf: superCsrf, action: "delete", id: postId }, superCookie)).status, 204);

  response = await request(`/admin/reports/${postId}`, { headers: { Cookie: superCookie } });
  const reportDetailReact = await response.text();
  assert.equal(response.status, 200);
  assert.match(reportDetailReact, /Contexto sintético/);
  assert.match(reportDetailReact, /Motivo &lt;script&gt;privado/);
  assert.equal((await form(`/admin/reports/${postId}/assign`, { csrf: superCsrf, moderatorId: actorId }, superCookie)).status, 204);
  assert.equal((await form(`/admin/reports/${postId}/resolve`, { csrf: superCsrf, status: "RESOLVED", action: "HIDE_POST", note: "Violação confirmada no teste" }, superCookie)).status, 204);

  response = await request(`/admin/users/${postId}`, { headers: { Cookie: superCookie } });
  const userDetailReact = await response.text();
  assert.equal(response.status, 200);
  assert.match(userDetailReact, /Pessoa &lt;teste&gt;/);
  assert.match(userDetailReact, /Artigos: 2/);
  response = await request(`/admin/users/${postId}/reports`, { headers: { Cookie: superCookie } });
  const userReportsReact = await response.text();
  assert.equal(response.status, 200);
  assert.match(userReportsReact, /Motivo &lt;teste&gt;/);
  assert.equal((await form(`/admin/users/${postId}/moderate`, { csrf: superCsrf, action: "revoke-sessions", reason: "Revogação preventiva" }, superCookie)).status, 204);
  assert.deepEqual(userActions.at(-1), { action: "revoke-sessions", body: { reason: "Revogação preventiva" } });
  assert.equal((await form(`/admin/users/${postId}/moderate`, { csrf: superCsrf, action: "suspend", reason: "Suspensão válida" }, superCookie)).status, 204);
  assert.equal((await form(`/admin/users/${postId}/moderate`, { csrf: superCsrf, action: "restore" }, superCookie)).status, 204);
});
