import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, createSession, deleteSession, formBody, getSession, getValidSession, randomSecret, refreshAfterUnauthorized, sameSecret } from '../src/lib/admin-security.ts';

const sid = '00000000-0000-4000-8000-000000000001';
const prefix = process.env.NODE_ENV === 'production' ? '__Secure-griforio' : 'griforio-dev';
function fixtureRefresh() { return { sessionId: sid, generation: 0, cookies: { [`${prefix}-rt-${sid}-0`]: 'refresh.old', [`${prefix}-proof-${sid}-0`]: 'p'.repeat(43) } }; }
function renewed(init, token = 'access-new') {
  const generation = Number(init.headers['X-Refresh-Generation']) + 1;
  const headers = new Headers();
  for (const [kind, value] of [['rt', 'refresh.new'], ['proof', 'p'.repeat(43)]]) headers.append('set-cookie', `${prefix}-${kind}-${sid}-${generation}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`);
  return new Response(JSON.stringify({ access_token: token, expires_in: 60, session_id: sid, generation, operation_id: init.headers['X-Refresh-Operation'] }), { headers });
}

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
  const created = createSession('access-old', 60, fixtureRefresh());
  created.session.tokenExpires = 0;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.match(init.headers.Cookie, /rt-.+=refresh.old/);
    await new Promise(resolve => setTimeout(resolve, 10));
    return renewed(init);
  };
  try {
    const [a, b] = await Promise.all([getValidSession(created.id), getValidSession(created.id)]);
    assert.equal(calls, 1);
    assert.equal(a.token, 'access-new');
    assert.equal(b.refresh.generation, 1);
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
  const inactive = createSession('access', 60, fixtureRefresh());
  inactive.session.idleExpires = Date.now() - 1;
  assert.equal(getSession(inactive.id), null);
  const original = globalThis.fetch;
  const active = createSession('access', 60, fixtureRefresh());
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
  const original = globalThis.fetch, created = createSession('old', 60, fixtureRefresh());
  let calls = 0;
  globalThis.fetch = async (_url, init) => { calls++; return renewed(init, 'new'); };
  try {
    assert.equal((await refreshAfterUnauthorized(created.id, 'old')).token, 'new');
    assert.equal((await refreshAfterUnauthorized(created.id, 'old')).token, 'new');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; deleteSession(created.id); }
});

test('falha transitória mantém a sessão administrativa e repete a mesma operação V2', async () => {
  const original = globalThis.fetch, created = createSession('old', 60, fixtureRefresh());
  const operations = [];
  created.session.tokenExpires = 0;
  globalThis.fetch = async (_url, init) => {
    operations.push(init.headers['X-Refresh-Operation']);
    assert.equal(init.headers.Origin, process.env.SITE_ORIGIN || 'http://localhost:3000');
    if (operations.length === 1) throw new Error('response lost after commit');
    return renewed(init);
  };
  try {
    await assert.rejects(getValidSession(created.id));
    assert.equal(getSession(created.id), created.session);
    assert.equal((await getValidSession(created.id)).token, 'access-new');
    assert.equal(operations[0], operations[1]);
  } finally { globalThis.fetch = original; deleteSession(created.id); }
});
