import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const frontDir = fileURLToPath(new URL("..", import.meta.url));
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const backendPkg = fileURLToPath(new URL("../../Backend-Blog/package.json", import.meta.url));

function totp(secret, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, value = 0; const bytes = [];
  for (const char of secret) { value = (value << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(), position = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(position) & 0x7fffffff) % 1000000).padStart(6, "0");
}

// Explicit opt-in; accounts are synthetic, no registration mail is sent, and cleanup disables them.
test("API real aplica a matriz administrativa a contas sintéticas", { skip: process.env.BLOG_ADMIN_REAL !== "1", timeout: 60000 }, async t => {
  const bcrypt = createRequire(backendPkg)("bcrypt");
  const password = `${randomBytes(24).toString("base64url")}aA1!`, hash = await bcrypt.hash(password, 12);
  const accounts = ["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].map(role => ({ role, id: randomUUID(), email: `fixture-admin-${randomUUID()}@example.test` }));
  const syntheticPosts = [];
  const syntheticCategories = [];
  const syntheticTags = [];
  const syntheticReports = [];
  const sql = statement => execFileSync("docker", ["exec", "blog_postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "blog_db", "-c", statement], { stdio: "ignore" });
  const ids = accounts.map(a => `'${a.id}'`).join(",");
  t.after(() => {
    if (syntheticReports.length) {
      const reps = syntheticReports.map(id => `'${id}'`).join(",");
      sql(`DELETE FROM reports WHERE id IN (${reps})`);
    }
    if (syntheticPosts.length) {
      const posts = syntheticPosts.map(id => `'${id}'`).join(",");
      sql(`UPDATE posts SET review_status = 'REJECTED' WHERE id IN (${posts}) AND review_status = 'PENDING'; UPDATE posts SET deleted_at = now(), is_active = false WHERE id IN (${posts}) AND author_id IN (${ids})`);
    }
    if (syntheticCategories.length) {
      const cats = syntheticCategories.map(id => `'${id}'`).join(",");
      sql(`DELETE FROM categories WHERE id IN (${cats})`);
    }
    if (syntheticTags.length) {
      const tgs = syntheticTags.map(id => `'${id}'`).join(",");
      sql(`DELETE FROM tags WHERE id IN (${tgs})`);
    }
    sql(`UPDATE users SET is_active = false, deleted_at = now(), auth_version = auth_version + 1 WHERE id IN (${ids}) AND email LIKE 'fixture-admin-%@example.test'`);
  });
  sql(`INSERT INTO users (id, name, email, password_hash, email_verified, role) VALUES ${accounts.map(a => `('${a.id}', 'Conta administrativa sintetica', '${a.email}', '${hash}', true, '${a.role}')`).join(",")}`);
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port; await new Promise(done => socket.close(done));
  const origin = "https://admin-real-test.example.test";
  const app = spawn(process.execPath, [nextBin, "start", "-p", String(port)], { cwd: frontDir, env: { ...process.env, NODE_ENV: "production", ENABLE_ADMIN_BFF: "true", API_ORIGIN: "http://127.0.0.1:3000", SITE_ORIGIN: origin }, stdio: "ignore" });
  t.after(() => app.kill());
  const frontend = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) { try { await fetch(frontend + "/gestao-editorial"); ready = true; break; } catch { if (app.exitCode !== null) break; await delay(100); } }
  assert.ok(ready, "Execute o build do frontend antes do teste real.");
  const frontRequest = (path, init = {}) => fetch(frontend + path, { redirect: "manual", ...init });
  const form = (path, values, cookie) => frontRequest(path, { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values) });
  const request = (path, token) => fetch(`http://127.0.0.1:3000/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store", signal: AbortSignal.timeout(10000) });
  assert.equal((await request("/admin/users?page=1&limit=1")).status, 401);
  for (const account of accounts) {
    const start = await frontRequest("/gestao-editorial/entrar");
    const loginPage = await start.text(), loginCsrf = loginPage.match(/name="csrf" value="([^"]+)"/)?.[1];
    const loginCookie = start.headers.getSetCookie().find(value => value.startsWith("__Host-editorial-login="))?.split(";")[0];
    assert.ok(loginCsrf && loginCookie);
    const panelLogin = await form("/gestao-editorial/entrar/sessao", { csrf: loginCsrf, email: account.email, password }, loginCookie);
    const authorized = ["ADMIN", "SUPER_ADMIN"].includes(account.role);
    assert.equal(panelLogin.status, authorized ? 303 : 403, `entrada BFF ${account.role}`);
    if (authorized) {
      const sessionCookie = panelLogin.headers.getSetCookie().find(value => value.startsWith("__Host-editorial-session="))?.split(";")[0];
      assert.ok(sessionCookie);
      for (const [path, label] of [["/gestao-editorial", "O Grifório em números"], ["/gestao-editorial/usuarios", "Contas da plataforma"], ["/gestao-editorial/comentarios", "Comentários"], ["/gestao-editorial/artigos", "Artigos da plataforma"], ["/gestao-editorial/denuncias", "Central de denúncias"], ["/gestao-editorial/estatisticas", "Movimentação da plataforma"], ["/gestao-editorial/auditoria", "Ações registradas"], ["/gestao-editorial/categorias", "Categorias editoriais"], ["/gestao-editorial/tags", "Tags da plataforma"]]) {
        const response = await frontRequest(path, { headers: { Cookie: sessionCookie } });
        assert.equal(response.status, 200, path);
        assert.ok((await response.text()).includes(label), `resposta válida ${path}`);
      }
      const editorial = await frontRequest("/gestao-editorial", { headers: { Cookie: sessionCookie } });
      const csrf = (await editorial.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
      assert.ok(csrf);
      if (account.role === "ADMIN") {
        const target = accounts.find(a => a.role === "READER"), path = `/gestao-editorial/usuarios/${target.id}`;
        const deniedRole = await frontRequest(`/gestao-editorial/usuarios/${target.id}/funcao`, { headers: { Cookie: sessionCookie } });
        assert.doesNotMatch(await deniedRole.text(), /Nova função/);
        assert.equal((await form(`/gestao-editorial/usuarios/${target.id}/funcao/alterar`, { csrf, role: "ADMIN", reason: "Teste sintetico", code: "123456" }, sessionCookie)).status, 403);
        const moderatePath = `/gestao-editorial/usuarios/${target.id}/moderar`;
        const suspension = await form(moderatePath, { csrf, action: "suspend", reason: "Teste administrativo sintetico" }, sessionCookie);
        assert.equal(suspension.status, 204);
        let detail = await frontRequest(path, { headers: { Cookie: sessionCookie } });
        assert.match(await detail.text(), /Suspensa/);
        const restoration = await form(moderatePath, { csrf, action: "restore" }, sessionCookie);
        assert.equal(restoration.status, 204);
        detail = await frontRequest(path, { headers: { Cookie: sessionCookie } });
        assert.match(await detail.text(), /Ativa/);
        assert.equal(syntheticPosts.length, 2);
        const reject = await form(`/gestao-editorial/artigos/${syntheticPosts[0]}/revisar`, { csrf, decision: "REJECTED", reason: "Rejeicao sintetica para teste" }, sessionCookie);
        assert.equal(reject.status, 204);
        const pendingSubscribers = execFileSync("docker", ["exec", "blog_postgres", "psql", "-U", "postgres", "-d", "blog_db", "-Atc", "SELECT count(*) FROM newsletter_subscribers WHERE confirmed = true"], { encoding: "utf8" }).trim();
        assert.equal(pendingSubscribers, "0", "Publicação de teste exige ausência de destinatários externos.");
        const approve = await form(`/gestao-editorial/artigos/${syntheticPosts[1]}/revisar`, { csrf, decision: "APPROVED", reason: "" }, sessionCookie);
        assert.equal(approve.status, 204);
        const approvedDetail = await frontRequest(`/gestao-editorial/artigos/${syntheticPosts[1]}`, { headers: { Cookie: sessionCookie } });
        assert.match(await approvedDetail.text(), /Publicado/);

        // Moderação de artigo (ocultar e restaurar)
        const hidePost = await form(`/gestao-editorial/artigos/${syntheticPosts[1]}/moderar`, { csrf, action: "hide", reason: "Ocultacao sintetica para teste" }, sessionCookie);
        assert.equal(hidePost.status, 204);
        const restorePost = await form(`/gestao-editorial/artigos/${syntheticPosts[1]}/moderar`, { csrf, action: "restore", reason: "Restauracao sintetica para teste" }, sessionCookie);
        assert.equal(restorePost.status, 204);

        // Revogação de sessões e moderação de usuário via BFF React
        const revoke = await form(`/gestao-editorial/usuarios/${target.id}/moderar`, { csrf, action: "revoke-sessions", reason: "Revogacao preventiva de teste" }, sessionCookie);
        assert.equal(revoke.status, 204);
        const suspendUser = await form(`/gestao-editorial/usuarios/${target.id}/moderar`, { csrf, action: "suspend", reason: "Suspensao moderada via React BFF" }, sessionCookie);
        assert.equal(suspendUser.status, 204);
        const restoreUser = await form(`/gestao-editorial/usuarios/${target.id}/moderar`, { csrf, action: "restore" }, sessionCookie);
        assert.equal(restoreUser.status, 204);

        // Gestão de categorias
        const catName = `Cat-${randomUUID().slice(0, 8)}`;
        const createCat = await form("/gestao-editorial/categorias/acao", { csrf, action: "create", name: catName, description: "Descricao sintetica" }, sessionCookie);
        assert.equal(createCat.status, 204);
        const catId = execFileSync("docker", ["exec", "blog_postgres", "psql", "-U", "postgres", "-d", "blog_db", "-Atc", `SELECT id FROM categories WHERE name = '${catName}'`], { encoding: "utf8" }).trim();
        assert.ok(catId);
        syntheticCategories.push(catId);
        const editCat = await form("/gestao-editorial/categorias/acao", { csrf, action: "edit", id: catId, name: `${catName} Editada`, slug: `slug-${randomUUID().slice(0, 8)}`, description: "Nova desc" }, sessionCookie);
        assert.equal(editCat.status, 204);
        const deleteCat = await form("/gestao-editorial/categorias/acao", { csrf, action: "delete", id: catId }, sessionCookie);
        assert.equal(deleteCat.status, 204);
        const reactivateCat = await form("/gestao-editorial/categorias/acao", { csrf, action: "reactivate", id: catId }, sessionCookie);
        assert.equal(reactivateCat.status, 204);
        const catState = execFileSync("docker", ["exec", "blog_postgres", "psql", "-U", "postgres", "-d", "blog_db", "-Atc", `SELECT is_active FROM categories WHERE id = '${catId}'`], { encoding: "utf8" }).trim();
        assert.equal(catState, "t");

        // Gestão de tags
        const tagName1 = `Tag1-${randomUUID().slice(0, 8)}`;
        const tagName2 = `Tag2-${randomUUID().slice(0, 8)}`;
        assert.equal((await form("/gestao-editorial/tags/acao", { csrf, action: "create", name: tagName1 }, sessionCookie)).status, 204);
        assert.equal((await form("/gestao-editorial/tags/acao", { csrf, action: "create", name: tagName2 }, sessionCookie)).status, 204);
        const tag1Id = execFileSync("docker", ["exec", "blog_postgres", "psql", "-U", "postgres", "-d", "blog_db", "-Atc", `SELECT id FROM tags WHERE name = '${tagName1}'`], { encoding: "utf8" }).trim();
        const tag2Id = execFileSync("docker", ["exec", "blog_postgres", "psql", "-U", "postgres", "-d", "blog_db", "-Atc", `SELECT id FROM tags WHERE name = '${tagName2}'`], { encoding: "utf8" }).trim();
        assert.ok(tag1Id && tag2Id);
        syntheticTags.push(tag1Id, tag2Id);
        assert.equal((await form("/gestao-editorial/tags/acao", { csrf, action: "edit", id: tag1Id, name: `${tagName1}-edit` }, sessionCookie)).status, 204);
        assert.equal((await form("/gestao-editorial/tags/acao", { csrf, action: "merge", id: tag1Id, targetId: tag2Id }, sessionCookie)).status, 204);
        assert.equal((await form("/gestao-editorial/tags/acao", { csrf, action: "delete", id: tag2Id }, sessionCookie)).status, 204);

        // Atribuição e resolução de denúncia
        const reportId = randomUUID();
        sql(`INSERT INTO reports (id, reporter_id, post_id, reason, status) VALUES ('${reportId}', '${accounts[0].id}', '${syntheticPosts[1]}', 'Denúncia sintética de teste', 'PENDING')`);
        syntheticReports.push(reportId);
        assert.equal((await form(`/gestao-editorial/denuncias/${reportId}/atribuir`, { csrf, moderatorId: account.id }, sessionCookie)).status, 204);
        assert.equal((await form(`/gestao-editorial/denuncias/${reportId}/resolver`, { csrf, status: "RESOLVED", action: "NONE", note: "Denúncia resolvida no teste sintético" }, sessionCookie)).status, 204);
      }
      if (account.role === "SUPER_ADMIN") {
        const target = accounts.find(a => a.role === "ADMIN");
        const moderatePath = `/gestao-editorial/usuarios/${target.id}/moderar`;
        assert.equal((await form(moderatePath, { csrf, action: "suspend", reason: "Teste sintetico de administracao" }, sessionCookie)).status, 204);
        assert.equal((await form(moderatePath, { csrf, action: "restore" }, sessionCookie)).status, 204);
      }
      assert.equal((await form("/gestao-editorial/sair", { csrf }, sessionCookie)).status, 303);
      assert.equal((await frontRequest("/gestao-editorial", { headers: { Cookie: sessionCookie } })).status, 307);
    }
    const login = await fetch("http://127.0.0.1:3000/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email, password }), signal: AbortSignal.timeout(10000) });
    assert.equal(login.status, 200, `login ${account.role}`);
    const token = (await login.json()).access_token;
    assert.equal(typeof token, "string");
    if (account.role === "AUTHOR") {
      for (let index = 0; index < 2; index++) {
        const created = await fetch("http://127.0.0.1:3000/api/v1/posts", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: `Artigo sintetico ${randomUUID()}`, content: "Conteudo sintetico para revisao administrativa.", published: false }), signal: AbortSignal.timeout(10000) });
        assert.equal(created.status, 201);
        const post = await created.json(); assert.match(post.id, /^[0-9a-f-]{36}$/i); syntheticPosts.push(post.id);
        const submitted = await fetch(`http://127.0.0.1:3000/api/v1/post-reviews/${post.id}/submit`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
        assert.equal(submitted.status, 201);
      }
    }
    for (const path of ["/admin/users?page=1&limit=1", "/admin/comments?page=1&limit=1", "/admin/posts?page=1&limit=1", "/admin/analytics/overview", "/admin/audit-logs?page=1&limit=1", "/reports?page=1&limit=1", "/post-reviews"]) {
      const response = await request(path, token);
      assert.equal(response.status, ["ADMIN", "SUPER_ADMIN"].includes(account.role) ? 200 : 403, `${account.role} ${path}`);
    }
    const own = await request(`/admin/users/${account.id}`, token);
    if (["ADMIN", "SUPER_ADMIN"].includes(account.role)) { assert.equal(own.status, 200); assert.equal((await own.json()).id, account.id); }
    else assert.equal(own.status, 403);
    if (account.role === "SUPER_ADMIN") {
      const setup = await fetch("http://127.0.0.1:3000/api/v1/auth/totp/setup", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      assert.equal(setup.status, 200);
      const secret = (await setup.json()).secret;
      const enable = await fetch("http://127.0.0.1:3000/api/v1/auth/totp/enable", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ code: totp(secret, -1) }) });
      assert.equal(enable.status, 200);
      const begin = await frontRequest("/gestao-editorial/entrar"), html = await begin.text();
      const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1], cookie = begin.headers.getSetCookie().find(v => v.startsWith("__Host-editorial-login="))?.split(";")[0];
      assert.ok(csrf && cookie);
      const nextLogin = await form("/gestao-editorial/entrar/sessao", { csrf, email: account.email, password, totpCode: totp(secret) }, cookie);
      assert.equal(nextLogin.status, 303);
      const session = nextLogin.headers.getSetCookie().find(v => v.startsWith("__Host-editorial-session="))?.split(";")[0]; assert.ok(session);
      const editorial = await frontRequest("/gestao-editorial", { headers: { Cookie: session } });
      const sessionCsrf = (await editorial.text()).match(/name="csrf" value="([^"]+)"/)?.[1]; assert.ok(sessionCsrf);
      const target = accounts.find(a => a.role === "READER"), page = await frontRequest(`/gestao-editorial/usuarios/${target.id}/funcao`, { headers: { Cookie: session } });
      assert.match(await page.text(), /Nova função/);
      const code = totp(secret, 1), change = { csrf: sessionCsrf, role: "ADMIN", reason: "Promocao sintetica para teste", code };
      assert.equal((await form(`/gestao-editorial/usuarios/${target.id}/funcao/alterar`, change, session)).status, 204);
      assert.equal((await form(`/gestao-editorial/usuarios/${target.id}/funcao/alterar`, change, session)).status, 401);
      const updated = await frontRequest(`/gestao-editorial/usuarios/${target.id}`, { headers: { Cookie: session } });
      assert.match(await updated.text(), />ADMIN</);
      assert.equal((await form("/gestao-editorial/sair", { csrf: sessionCsrf }, session)).status, 303);
    } else {
      const logout = await fetch("http://127.0.0.1:3000/api/v1/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
      assert.equal(logout.status, 200);
    }
    assert.equal((await request("/admin/users?page=1&limit=1", token)).status, 401);
  }
});
