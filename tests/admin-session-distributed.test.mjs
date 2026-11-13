import './support/admin-store.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';

const root = fileURLToPath(new URL('..', import.meta.url));
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
async function port() {
  const server = createServer().listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value;
}

test('login survives another Next process, reload and restart; invalid sessions stay rejected', { timeout: 60000 }, async t => {
  const origin = `https://${randomUUID()}.example.test`, actor = randomUUID(), sid = randomUUID();
  const token = `test.${Buffer.from(JSON.stringify({ sub: actor })).toString('base64url')}.test`;
  let revoked = false, rotations = 0;
  const api = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    let body = ''; for await (const chunk of req) body += chunk;
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    const credentials = generation => res.setHeader('Set-Cookie', [
      `__Secure-griforio-rt-${sid}-${generation}=synthetic.refresh; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`,
      `__Secure-griforio-proof-${sid}-${generation}=${'p'.repeat(43)}; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`,
    ]);
    if (req.url === '/api/v1/auth/login') {
      const input = JSON.parse(body);
      if (!input.totpCode) return send(200, { requires2fa: true });
      if (input.totpCode !== '123456') return send(401, {});
      credentials(0);
      return send(200, { access_token: token, expires_in: 900, refresh_protocol: 2, refresh_generation: 0, session_id: sid });
    }
    if (req.url === '/api/v1/auth/refresh/v2') {
      if (revoked) return send(401, {});
      rotations++; await delay(50);
      const generation = Number(req.headers['x-refresh-generation']) + 1; credentials(generation);
      return send(200, { access_token: token, expires_in: 900, session_id: sid, generation, operation_id: req.headers['x-refresh-operation'] });
    }
    if (req.url === '/api/v1/auth/logout/v2') { revoked = true; return send(200, {}); }
    if (revoked || req.headers.authorization !== `Bearer ${token}`) return send(401, {});
    if (req.url === `/api/v1/users/${actor}`) return send(200, { id: actor, role: 'ADMIN', totpEnabled: true });
    if (req.url === '/api/v1/admin/analytics/overview') return send(200, { users: { total: 1 }, posts: { total: 0, published: 0 }, reports: { pending: 0 }, generatedAt: new Date().toISOString() });
    return send(404, {});
  }).listen(0, '127.0.0.1');
  await once(api, 'listening'); t.after(() => api.close());
  const children = [];
  t.after(() => children.forEach(child => child.kill()));
  async function start(overrides = {}) {
    const listen = await port();
    const child = spawn(process.execPath, [next, 'start', '-p', String(listen)], { cwd: root, env: { ...process.env, NODE_ENV: 'production', SITE_ORIGIN: origin, API_ORIGIN: `http://127.0.0.1:${api.address().port}`, ENABLE_ADMIN_BFF: 'true', ...overrides }, stdio: 'ignore' });
    children.push(child);
    const base = `http://127.0.0.1:${listen}`;
    for (let i = 0; i < 100; i++) {
      assert.equal(child.exitCode, null, 'Next exited; build before running the test');
      try { await fetch(base + '/gestao-editorial/entrar'); return { child, base }; } catch { await delay(100); }
    }
    throw new Error('Next did not start');
  }
  const a = await start(), b = await start();
  const request = (server, cookie) => fetch(server.base + '/gestao-editorial', { headers: { Cookie: cookie }, redirect: 'manual' });
  const cookieFrom = response => response.headers.getSetCookie().find(value => value.startsWith('__Host-editorial-session='))?.split(';')[0];
  async function login(server, code) {
    const entry = await fetch(server.base + '/gestao-editorial/entrar');
    const csrf = (await entry.text()).match(/name="csrf" value="([^"]+)"/)[1];
    return fetch(server.base + '/gestao-editorial/entrar/sessao', { method: 'POST', redirect: 'manual', headers: { Origin: origin, Cookie: entry.headers.getSetCookie()[0].split(';')[0] }, body: new URLSearchParams({ csrf, email: 'synthetic@example.invalid', password: 'Synthetic1!', totpCode: code }) });
  }
  for (const code of ['', '654321']) {
    const denied = await login(a, code); assert.equal(denied.status, 401); assert.equal(cookieFrom(denied), undefined);
  }
  const created = await login(a, '123456'); assert.equal(created.status, 303);
  assert.equal(created.headers.get('location'), '/gestao-editorial');
  const cookie = cookieFrom(created); assert.ok(cookie);
  assert.match(cookie, /^__Host-editorial-session=[A-Za-z0-9_-]{43}$/);
  const first = await request(b, cookie); assert.equal(first.status, 200);
  const html = await first.text(); assert.match(html, /Contas cadastradas/);
  const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  assert.equal((await request(a, cookie)).status, 200);
  a.child.kill(); await once(a.child, 'exit');
  const restarted = await start(); assert.equal((await request(restarted, cookie)).status, 200);
  // Force token expiry in the encrypted shared state, then race two instances.
  const { readStoredSession, withStoredSession, closeAdminSessionStore } = await import('../src/lib/admin-session-store.ts');
  const previousOrigin = process.env.SITE_ORIGIN; process.env.SITE_ORIGIN = origin;
  const key = createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  const redis = new Redis(process.env.REDIS_URL);
  const storageKey = `griforio:editorial:${createHash('sha256').update(origin).digest('hex')}:${key}`;
  t.after(async () => { try { await redis.del(storageKey); } finally { redis.disconnect(); } });
  try {
    const ciphertext = await redis.get(storageKey);
    assert.ok(ciphertext); assert.ok((await redis.pttl(storageKey)) > 0);
    assert.ok(!ciphertext.includes(token) && !ciphertext.includes('synthetic.refresh'));
    await withStoredSession(key, async (save, remove) => {
      // Simulate a paused instance whose lease has expired and been acquired elsewhere.
      await redis.set(`${storageKey}:lock`, 'another-owner', 'PX', 60000);
      await assert.rejects(save(await readStoredSession(key), Date.now() + 60000), /lock expired/);
      await assert.rejects(remove(), /lock expired/);
    });
    assert.equal(await redis.get(`${storageKey}:lock`), 'another-owner');
    await redis.del(`${storageKey}:lock`);
    await withStoredSession(key, async save => { const session = await readStoredSession(key); session.tokenExpires = 0; await save(session, Math.min(session.expires, session.idleExpires)); });
    const concurrent = await Promise.all([request(b, cookie), request(restarted, cookie)]);
    assert.deepEqual(concurrent.map(value => value.status), [200, 200]); assert.equal(rotations, 1);
    for (const invalid of ['bad', 'a'.repeat(43), cookie.split('=')[1].slice(0, -1) + '!']) assert.equal((await request(b, `__Host-editorial-session=${invalid}`)).status, 307);
    // A changed key or corrupted ciphertext never authorizes a session.
    const wrongKey = await start({ ADMIN_SESSION_ENCRYPTION_KEY: 'b'.repeat(64) });
    assert.equal((await request(wrongKey, cookie)).status, 307);
    const unconfigured = await start({ ADMIN_SESSION_ENCRYPTION_KEY: '' });
    const failed = await login(unconfigured, '123456'); assert.equal(failed.status, 503); assert.equal(cookieFrom(failed), undefined);
    // The failed login's cleanup revokes only its upstream session in production.
    revoked = false;
    await redis.set(storageKey, 'tampered', 'PX', 60000);
    assert.equal((await request(b, cookie)).status, 307);
    await redis.set(storageKey, ciphertext, 'PX', 60000);
    const logout = await fetch(b.base + '/gestao-editorial/sair', { method: 'POST', redirect: 'manual', headers: { Origin: origin, Cookie: cookie }, body: new URLSearchParams({ csrf }) });
    assert.equal(logout.status, 303); assert.equal((await request(restarted, cookie)).status, 307);
  } finally {
    closeAdminSessionStore();
    if (previousOrigin === undefined) delete process.env.SITE_ORIGIN; else process.env.SITE_ORIGIN = previousOrigin;
  }
});
