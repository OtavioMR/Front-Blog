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

test("BFF editorial protege entradas, dados, ações e sessão", { timeout: 30000 }, async (t) => {
  const roles = new Map();
  const revoked = new Set();
  const decisions = [];
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
    const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!roles.has(token) || revoked.has(token)) { response.statusCode = 401; return response.end("{}"); }
    if (request.method === "POST" && request.url === "/api/v1/auth/logout") { revoked.add(token); return response.end("{}"); }
    if (roles.get(token) !== "ADMIN") { response.statusCode = 403; return response.end("{}"); }
    if (request.method === "GET" && request.url === "/api/v1/post-reviews") return response.end(JSON.stringify([{ id: postId, title: "Artigo sintético", content: `<p>${privateText}</p><script>alert(1)</script><img src=x onerror=alert(1)>` }]));
    if (request.method === "POST" && request.url === `/api/v1/post-reviews/${postId}/decision`) { decisions.push(JSON.parse(body).decision); response.statusCode = 201; return response.end("{}"); }
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
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  const csrf = csrfFrom(html);
  const decision = { csrf, id: postId, decision: "APPROVED" };
  assert.equal((await form("/gestao-editorial", decision, sessionCookie, "https://outside.example.test")).status, 403);
  assert.equal((await form("/gestao-editorial", { ...decision, csrf: "invalid" }, sessionCookie)).status, 403);
  assert.deepEqual(decisions, []);
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 303);
  assert.deepEqual(decisions, ["APPROVED"]);

  const adminToken = [...roles.entries()].find(([, role]) => role === "ADMIN")[0];
  roles.set(adminToken, "AUTHOR");
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 403);
  assert.deepEqual(decisions, ["APPROVED"]);
  roles.set(adminToken, "ADMIN");
  revoked.add(adminToken);
  response = await request("/gestao-editorial", { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), new RegExp(privateText));
  assert.equal((await form("/gestao-editorial", decision, sessionCookie)).status, 401);
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
