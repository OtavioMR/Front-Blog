import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/posts/[slug]/track-post-view.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const id = "00000000-0000-4000-8000-000000000001";

function browser() {
  const requests = [];
  const timers = new Map();
  let serial = 0;
  let observer;
  function target() {
    const handlers = new Map();
    return { handlers, addEventListener(type, fn) { handlers.set(type, fn); }, removeEventListener(type) { handlers.delete(type); }, emit(type, event = {}) { handlers.get(type)?.(event); } };
  }
  const doc = { ...target(), visibilityState: "visible" };
  const win = target();
  const article = {};
  const context = {
    exports: {}, document: doc, window: win,
    IntersectionObserver: class {
      constructor(callback) { observer = callback; }
      observe() {} disconnect() {}
    },
    setTimeout: (callback) => { const key = ++serial; timers.set(key, callback); return key; },
    clearTimeout: (key) => timers.delete(key),
    fetch: async (url, options) => { requests.push({ url, options }); throw new Error("fixture unavailable"); },
  };
  vm.runInNewContext(compiled, context);
  return { track: () => context.exports.trackPostView(id, article), invalid: () => context.exports.trackPostView("bad-id", article), doc, win, requests, timers,
    intersect(value) { observer([{ target: article, isIntersecting: value }]); },
    elapse() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); } };
}

test("exige visibilidade e interação real antes de registrar", () => {
  const b = browser();
  b.track();
  b.intersect(true);
  b.elapse();
  assert.equal(b.requests.length, 0);
  b.win.emit("keydown", { isTrusted: false });
  b.elapse();
  assert.equal(b.requests.length, 0);
  b.win.emit("keydown", { isTrusted: true });
  b.elapse();
  assert.equal(b.requests.length, 1);
  assert.equal(b.requests[0].url, `/api/v1/posts/${id}/views`);
  assert.equal(b.requests[0].options.method, "POST");
  assert.equal(b.requests[0].options.credentials, "omit");
});

test("aba oculta ou artigo fora da tela cancela a espera", () => {
  const b = browser();
  b.track(); b.intersect(true); b.win.emit("scroll", { isTrusted: true });
  b.doc.visibilityState = "hidden"; b.doc.emit("visibilitychange"); b.elapse();
  assert.equal(b.requests.length, 0);
  b.doc.visibilityState = "visible"; b.doc.emit("visibilitychange"); b.intersect(false); b.elapse();
  assert.equal(b.requests.length, 0);
  b.intersect(true); b.elapse();
  assert.equal(b.requests.length, 1);
});

test("montagem repetida, falha e identificador inválido não duplicam chamadas", () => {
  const b = browser();
  b.invalid();
  const stop = b.track(); b.intersect(true); b.win.emit("pointerdown", { isTrusted: true }); stop(); b.elapse();
  assert.equal(b.requests.length, 0);
  b.track(); b.intersect(true); b.win.emit("pointerdown", { isTrusted: true }); b.elapse();
  b.track(); b.win.emit("pointerdown", { isTrusted: true }); b.elapse();
  assert.equal(b.requests.length, 1);
});
