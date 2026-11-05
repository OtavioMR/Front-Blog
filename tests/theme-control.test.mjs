import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup({ blocked = false } = {}) {
  const listeners = new Map();
  const values = new Map();
  const document = { documentElement: { dataset: {} } };
  const localStorage = {
    getItem(key) { if (blocked) throw Error("blocked"); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error("blocked"); values.set(key, value); },
    removeItem(key) { if (blocked) throw Error("blocked"); values.delete(key); },
  };
  const window = {
    addEventListener(name, fn) { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
  };
  let changed = 0;
  let snapshot;
  const source = readFileSync(new URL("../src/app/_components/theme-control.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const require = name => name === "react" ? { useSyncExternalStore(subscribe, getSnapshot) { snapshot = getSnapshot; subscribe(() => changed++); return getSnapshot(); } } : name === "react/jsx-runtime" ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } : { default: {} };
  vm.runInNewContext(compiled, { exports, require, window, document, localStorage, Event: class { constructor(type) { this.type = type; } } });
  const render = () => exports.default();
  const select = () => render().props.children[1];
  return { values, document, window, select, snapshot: () => snapshot(), changed: () => changed };
}

test("theme selection persists, updates the document and returns to system", () => {
  const app = setup();
  assert.equal(app.select().props.value, "system");
  app.select().props.onChange({ target: { value: "dark" } });
  assert.equal(app.document.documentElement.dataset.theme, "dark");
  assert.equal(app.values.get("entrelinhas-theme"), "dark");
  assert.equal(app.snapshot(), "dark");
  app.select().props.onChange({ target: { value: "system" } });
  assert.equal(app.document.documentElement.dataset.theme, undefined);
  assert.equal(app.values.has("entrelinhas-theme"), false);
  assert.equal(app.snapshot(), "system");
});

test("storage changes in another tab update the current document", () => {
  const app = setup(); app.select();
  app.values.set("entrelinhas-theme", "light");
  app.window.dispatchEvent({ type: "storage", key: "entrelinhas-theme" });
  assert.equal(app.document.documentElement.dataset.theme, "light");
  assert.equal(app.snapshot(), "light");
  assert.ok(app.changed() > 0);
});

test("theme can still change in the current tab when storage is blocked", () => {
  const app = setup({ blocked: true });
  app.select().props.onChange({ target: { value: "dark" } });
  assert.equal(app.snapshot(), "dark");
});

