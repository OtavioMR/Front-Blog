import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, createSession, deleteSession, formBody, getSession, getValidSession, randomSecret, refreshAfterUnauthorized, sameSecret } from '../src/lib/admin-security.ts';

test('origem mutável é exata e token CSRF não aceita valores alterados', async () => {
  const previous = process.env.SITE_ORIGIN;
  process.env.SITE_ORIGIN = 'http://localhost:3000';
  try {
    assert.equal(allowedOrigin('http://localhost:3000'), true);
    for (const value of [null, 'null', 'http://127.0.0.1:3000', 'http://localhost:3001', 'https://localhost:3000']) assert.equal(allowedOrigin(value), false);
    const csrf = randomSecret();
    assert.equal(sameSecret(csrf, csrf), true);
    assert.equal(sameSecret(csrf, randomSecret()), false);
    assert.equal(sameSecret(csrf, undefined), false);
    const valid = new Request('http://localhost:3000/', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
    assert.equal((await formBody(valid)).get('x'), '1');
    const hostile = new Request('http://localhost:3000/', { method: 'POST', headers: { origin: 'https://evil.example.test', 'content-type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
    assert.equal(await formBody(hostile), null);
    const tooLarge = new Request('http://localhost:3000/', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/x-www-form-urlencoded', 'content-length': '1' }, body: 'x=' + 'a'.repeat(8192) });
    assert.equal(await formBody(tooLarge), null);
  } finally { if (previous === undefined) delete process.env.SITE_ORIGIN; else process.env.SITE_ORIGIN = previous; }
});

test('renovação concorrente reutiliza uma única rotação e revogação encerra a sessão', async () => {
  const original = globalThis.fetch;
  const created = createSession('access-old', 60, 'refresh.old');
  created.session.tokenExpires = 0;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(init.headers.Cookie, 'refreshToken=refresh.old');
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ access_token: 'access-new', expires_in: 60 }), { headers: { 'set-cookie': 'refreshToken=refresh.new; HttpOnly; Path=/api/v1/auth' } });
  };
  try {
    const [a, b] = await Promise.all([getValidSession(created.id), getValidSession(created.id)]);
    assert.equal(calls, 1);
    assert.equal(a.token, 'access-new');
    assert.equal(b.refreshToken, 'refresh.new');
    a.tokenExpires = 0;
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal(await getValidSession(created.id), null);
    assert.equal(getSession(created.id), null);
  } finally { globalThis.fetch = original; deleteSession(created.id); }
});

test('sessão opaca é aleatória, limitada e removível', () => {
  const first = createSession('fake-test-access', 60);
  const second = createSession('fake-test-access', 60);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, first.session.token);
  assert.equal(getSession(first.id)?.token, 'fake-test-access');
  assert.equal(getSession(randomSecret()), null);
  assert.throws(() => createSession('fake-test-access', 10));
  deleteSession(first.id);
  assert.equal(getSession(first.id), null);
  deleteSession(second.id);
});

test('sessão expira por inatividade e não ressuscita após logout durante renovação', async () => {
  const inactive = createSession('access', 60, 'refresh.old');
  inactive.session.idleExpires = Date.now() - 1;
  assert.equal(getSession(inactive.id), null);
  const original = globalThis.fetch;
  const active = createSession('access', 60, 'refresh.old');
  active.session.tokenExpires = 0;
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  try {
    const pending = getValidSession(active.id);
    deleteSession(active.id);
    finish(new Response(JSON.stringify({ access_token: 'new', expires_in: 60 }), { headers: { 'set-cookie': 'refreshToken=refresh.new; HttpOnly' } }));
    assert.equal(await pending, null);
    assert.equal(getSession(active.id), null);
  } finally { globalThis.fetch = original; deleteSession(active.id); }
});

test('401 inesperado renova uma vez e aproveita rotação já feita por outra leitura', async () => {
  const original = globalThis.fetch, created = createSession('old', 60, 'refresh.old');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ access_token: 'new', expires_in: 60 }), { headers: { 'set-cookie': 'refreshToken=refresh.new; HttpOnly' } }); };
  try {
    assert.equal((await refreshAfterUnauthorized(created.id, 'old')).token, 'new');
    assert.equal((await refreshAfterUnauthorized(created.id, 'old')).token, 'new');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; deleteSession(created.id); }
});
