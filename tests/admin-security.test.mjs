import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, createSession, deleteSession, formBody, getSession, randomSecret, sameSecret } from '../src/lib/admin-security.ts';

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
