import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

// Run the actual client module in an isolated browser simulation, without a network.
const source = await readFile(new URL("../src/lib/session-client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function browser() {
  const storage = new Map();
  let now = 1000;
  let id = 0;
  let loginStatus = 200;
  let loginFails = false;
  let loginToken = "fixture-access-token";
  let refreshFails = false;
  let refreshHangs = false;
  let lock = Promise.resolve();
  const requests = [];
  const messages = [];
  const context = {
    exports: {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); },
      removeItem: key => { storage.delete(key); },
    },
    navigator: { locks: { request: (_name, task) => {
      const result = lock.then(task);
      lock = result.catch(() => {});
      return result;
    } } },
    BroadcastChannel: class { postMessage(value) { messages.push(value); } },
    crypto: { randomUUID: () => `test-epoch-${++id}`, getRandomValues: value => webcrypto.getRandomValues(value) },
    btoa, Uint8Array,
    AbortSignal: { timeout: () => AbortSignal.timeout(20) },
    Date: { now: () => now, parse: Date.parse },
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    fetch: async (url, options) => {
      requests.push({ url, authorization: options.headers?.Authorization, operation: options.headers?.["X-Refresh-Operation"] });
      if (url.endsWith('/login') && loginFails) throw new Error('temporary login failure');
      if (url.endsWith("/refresh/v2") && refreshHangs) return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
      });
      if (url.endsWith("/refresh/v2") && refreshFails) throw new Error("simulated connection loss");
      const status = url.endsWith("/login") ? loginStatus : 200;
      return {
        ok: status === 200,
        status,
        json: async () => ({ access_token: url.endsWith("/refresh/v2") ? "fixture-refreshed-token" : loginToken, token_type: "Bearer", expires_in: 60,
          session_id: '00000000-0000-4000-8000-000000000001', refresh_protocol: 2, refresh_generation: 0,
          generation: Number(options.headers?.['X-Refresh-Generation'] ?? 0) + 1, operation_id: options.headers?.['X-Refresh-Operation'], recovery_deadline: new Date(now + 60000).toISOString(),
        }),
      };
    },
  };
  vm.runInNewContext(compiled, context);
  return {
    session: context.exports,
    reload() { const fresh = { ...context, exports: {} }; vm.runInNewContext(compiled, fresh); return fresh.exports; },
    requests,
    messages,
    get stored() { return storage.get('blog-session-coordination-v2') ?? null; },
    writeLegacy(value) { storage.set('blog-session-coordination-v1', value); },
    set loginStatus(value) { loginStatus = value; },
    set loginFails(value) { loginFails = value; },
    set loginToken(value) { loginToken = value; },
    set refreshFails(value) { refreshFails = value; },
    set refreshHangs(value) { refreshHangs = value; },
    advance(ms) { now += ms; },
  };
}

const signIn = (session) => session.login("reader@example.test", "fixture-password", "");

test('falha transitória ao tentar entrar em outra conta não destrói a sessão anterior', async () => {
  const b = browser(); await signIn(b.session);
  const previous = b.stored; b.loginFails = true;
  await assert.rejects(signIn(b.session));
  assert.equal(b.stored, previous);
  assert.equal(await b.session.restoreSession(), true);
});

test('uma aba antiga não sobrescreve o estado de coordenação V2', async () => {
  const b = browser(); await signIn(b.session); const current = b.stored;
  b.writeLegacy(JSON.stringify({ epoch: 'old-tab', pending: true }));
  assert.equal(b.stored, current);
  assert.equal(await b.session.restoreSession(), true);
});

test("falhas confirmadas de login preservam a sessão anterior", async () => {
  const b = browser();
  await signIn(b.session);
  const original = b.stored;
  const messageCount = b.messages.length;
  for (const status of [400, 401, 403, 429]) {
    b.loginStatus = status;
    await assert.rejects(signIn(b.session));
    assert.equal(b.stored, original);
    assert.equal(await b.session.restoreSession(), true);
  }
  assert.equal(b.messages.length, messageCount);
  assert.equal(b.requests.filter((request) => request.url.endsWith("/refresh")).length, 0);
});

test("invalidação local não afeta conta trocada e avisa outras abas", async () => {
  const b = browser();
  const first = "00000000-0000-4000-8000-000000000001";
  const second = "00000000-0000-4000-8000-000000000002";
  const jwt = (sub) => `fixture.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.fixture`;
  b.loginToken = jwt(first);
  await signIn(b.session);
  b.loginToken = jwt(second);
  await signIn(b.session);
  const state = b.stored;
  const count = b.messages.length;
  assert.equal(await b.session.invalidateSessionForSubject(first), false);
  assert.equal(b.stored, state);
  assert.equal(await b.session.restoreSession(), true);
  assert.equal(await b.session.invalidateSessionForSubject(second), true);
  assert.equal(JSON.parse(b.stored).pending, true);
  assert.equal(b.messages.length, count + 1);
  assert.equal(await b.session.restoreSession(), false);
  assert.equal(b.requests.filter((request) => request.url.endsWith("/logout")).length, 0);
});

test("refresh incerto preserva a operação e pode ser recuperado após recarga", async () => {
  const b = browser();
  await signIn(b.session);
  b.advance(61_000);
  b.refreshFails = true;
  await assert.rejects(b.session.restoreSession());
  assert.equal(JSON.parse(b.stored).pending, true);
  b.refreshFails = false;
  assert.equal(await b.reload().restoreSession(), true);
  const attempts = b.requests.filter(request => request.url.endsWith('/refresh/v2'));
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].operation, attempts[1].operation);
});

test("timeout libera bloqueio e a recuperação repete o mesmo ID, sem reuso arbitrário", async () => {
  const b = browser();
  await signIn(b.session);
  b.advance(61_000);
  b.refreshHangs = true;
  const pending = b.session.restoreSession();
  const queued = b.session.restoreSession();
  await assert.rejects(pending);
  await assert.rejects(queued);
  assert.equal(JSON.parse(b.stored).pending, true);
  b.refreshHangs = false;
  assert.equal(await b.session.restoreSession(), true);
  const attempts = b.requests.filter(request => request.url.endsWith('/refresh/v2'));
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].operation, attempts[1].operation);
});

test("logout V2 revoga com cookies sem precisar renovar token expirado", async () => {
  const b = browser();
  await signIn(b.session);
  b.advance(61_000);
  assert.equal(await b.session.logout(), true);
  assert.deepEqual(b.requests.map((request) => request.url), ["/api/v1/auth/login", "/api/v1/auth/logout/v2"]);
  assert.equal(b.requests.at(-1).authorization, "Bearer fixture-access-token");
});

test("armazenamento e eventos não recebem tokens", async () => {
  const b = browser();
  await signIn(b.session);
  b.advance(61_000);
  assert.equal(await b.session.restoreSession(), true);
  assert.equal(await b.session.logout(), true);
  const persisted = `${b.stored} ${JSON.stringify(b.messages)}`;
  assert.doesNotMatch(persisted, /fixture-(access|refreshed)-token|fixture-password/);
  assert.deepEqual(Object.keys(JSON.parse(b.stored)).sort(), ["epoch", "generation", "loggedOut", "pending", "sessionId"]);
});
