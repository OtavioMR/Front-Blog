import assert from 'node:assert/strict';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { parseEnv } from 'node:util';

// Opt-in integration against the existing local Nest, Next, PostgreSQL and Redis.
// No SMTP calls; only this synthetic account and its own sessions are modified.
test('local real admin completes TOTP login, immediate navigation, reload and logout', {
  skip: process.env.BLOG_ADMIN_LOCAL_REAL !== '1', timeout: 45000,
}, async t => {
  const frontend = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
  const backend = parseEnv(await readFile(new URL('../../Backend-Blog/.env', import.meta.url), 'utf8'));
  const local = value => ['localhost', '127.0.0.1', '[::1]'].includes(value);
  assert.ok(local(backend.DB_HOST), 'This test requires the configured local database');
  assert.ok(local(new URL(frontend.SITE_ORIGIN).hostname));
  assert.ok(local(new URL(frontend.API_ORIGIN).hostname));
  assert.ok(frontend.REDIS_URL && /^[a-f0-9]{64}$/i.test(frontend.ADMIN_SESSION_ENCRYPTION_KEY || ''), 'Local administrative session configuration is incomplete');
  const require = createRequire(new URL('../../Backend-Blog/package.json', import.meta.url));
  const { Pool } = require('pg'), bcrypt = require('bcrypt');
  const { generateSecret, generateSync } = require('otplib');
  const db = new Pool({ host: backend.DB_HOST, port: Number(backend.DB_PORT), user: backend.DB_USER, password: backend.DB_PASSWORD, database: backend.DB_NAME });
  const id = randomUUID(), email = `synthetic-admin-login-${id}@example.invalid`, password = `${randomBytes(24).toString('base64url')}aA1!`;
  const secret = generateSecret(), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(backend.TOTP_ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const totpSecret = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  const hash = await bcrypt.hash(password, 12);
  t.after(async () => {
    try {
      await db.query('DELETE FROM auth_sessions WHERE user_id=$1', [id]);
      await db.query('DELETE FROM audit_logs WHERE actor_id=$1 OR target_id=$1', [id]);
      await db.query('DELETE FROM users WHERE id=$1 AND email=$2', [id, email]);
    } finally { await db.end(); }
  });
  await db.query(`INSERT INTO users(id,name,email,password_hash,role,email_verified,totp_enabled,totp_secret,recovery_email,recovery_email_verified_at)
    VALUES ($1,'Synthetic local admin login',$2,$3,'ADMIN',true,true,$4,$5,now())`, [id, email, hash, totpSecret, `recovery-${id}@example.invalid`]);
  const base = frontend.SITE_ORIGIN;
  const request = (path, init = {}) => fetch(base + path, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const entry = await request('/gestao-editorial/entrar'); assert.equal(entry.status, 200);
  const csrf = (await entry.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
  const temporary = entry.headers.getSetCookie().find(value => /^(?:__Host-editorial-login|editorial-login-dev)=/.test(value))?.split(';')[0];
  assert.ok(csrf && temporary);
  const login = await request('/gestao-editorial/entrar/sessao', {
    method: 'POST', headers: { Origin: base, Cookie: temporary },
    body: new URLSearchParams({ csrf, email, password, totpCode: generateSync({ secret }) }),
  });
  assert.equal(login.status, 303, 'Real local login must persist the session before redirecting');
  const cookie = login.headers.getSetCookie().find(value => /^(?:__Host-editorial-session|editorial-session-dev)=/.test(value))?.split(';')[0];
  assert.ok(cookie);
  const first = await request('/gestao-editorial', { headers: { Cookie: cookie } }); assert.equal(first.status, 200);
  const html = await first.text(); assert.match(html, /Contas cadastradas/);
  const sessionCsrf = html.match(/name="csrf" value="([^"]+)"/)?.[1]; assert.ok(sessionCsrf);
  const reload = await request('/gestao-editorial', { headers: { Cookie: cookie } });
  if (reload.status !== 200) {
    Object.assign(process.env, { SITE_ORIGIN: base, REDIS_URL: frontend.REDIS_URL, ADMIN_SESSION_ENCRYPTION_KEY: frontend.ADMIN_SESSION_ENCRYPTION_KEY });
    const { getSession } = await import('../src/lib/admin-security.ts');
    const { closeAdminSessionStore } = await import('../src/lib/admin-session-store.ts');
    try {
      const state = await getSession(cookie.split('=')[1]);
      if (state) {
        const profile = await fetch(`${frontend.API_ORIGIN}/api/v1/users/${id}`, { headers: { Authorization: `Bearer ${state.token}` } });
        t.diagnostic(`Reload status=${reload.status}; upstream identity status=${profile.status}`);
      } else t.diagnostic(`Reload status=${reload.status}; shared session absent`);
    } finally { closeAdminSessionStore(); }
  }
  assert.equal(reload.status, 200);
  const logout = await request('/gestao-editorial/sair', { method: 'POST', headers: { Origin: base, Cookie: cookie }, body: new URLSearchParams({ csrf: sessionCsrf }) });
  assert.equal(logout.status, 303);
  assert.equal((await request('/gestao-editorial', { headers: { Cookie: cookie } })).status, 307);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM auth_sessions WHERE user_id=$1', [id])).rows[0].count, 0);
});
