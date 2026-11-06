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
  const source = readFileSync(new URL("../src/app/_components/bg-tone-control.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const require = name => name === "react" ? { useSyncExternalStore(subscribe, getSnapshot) { snapshot = getSnapshot; subscribe(() => changed++); return getSnapshot(); } } : name === "react/jsx-runtime" ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } : { default: {} };
  vm.runInNewContext(compiled, { exports, require, window, document, localStorage, Event: class { constructor(type) { this.type = type; } } });

  const render = () => exports.default();
  const buttons = () => {
    const rendered = render();
    // rendered.props.children is [headingDiv, gridDiv]
    const grid = rendered.props.children[1];
    return grid.props.children; // array of 2 buttons: [neutralButton, warmButton]
  };

  return { exports, values, document, window, buttons, snapshot: () => snapshot(), changed: () => changed };
}

test("background tone defaults to neutral when unset", () => {
  const app = setup();
  const [neutralBtn, warmBtn] = app.buttons();
  assert.equal(app.snapshot(), "neutral");
  assert.equal(neutralBtn.props["aria-checked"], true);
  assert.equal(warmBtn.props["aria-checked"], false);
});

test("selecting warm tone persists to storage, updates document dataset, and dispatches event", () => {
  const app = setup();
  const [, warmBtn] = app.buttons();
  warmBtn.props.onClick();

  assert.equal(app.document.documentElement.dataset.bgTone, "warm");
  assert.equal(app.values.get("entrelinhas-bg-tone"), "warm");
  assert.equal(app.snapshot(), "warm");

  const [newNeutralBtn, newWarmBtn] = app.buttons();
  assert.equal(newNeutralBtn.props["aria-checked"], false);
  assert.equal(newWarmBtn.props["aria-checked"], true);
});

test("selecting neutral tone resets document dataset and persists", () => {
  const app = setup();
  const [, warmBtn] = app.buttons();
  warmBtn.props.onClick();
  assert.equal(app.snapshot(), "warm");

  const [neutralBtn] = app.buttons();
  neutralBtn.props.onClick();
  assert.equal(app.document.documentElement.dataset.bgTone, "neutral");
  assert.equal(app.values.get("entrelinhas-bg-tone"), "neutral");
  assert.equal(app.snapshot(), "neutral");
});

test("storage changes in another tab update document dataset and component snapshot", () => {
  const app = setup();
  app.buttons();

  app.values.set("entrelinhas-bg-tone", "warm");
  app.window.dispatchEvent({ type: "storage", key: "entrelinhas-bg-tone" });

  assert.equal(app.document.documentElement.dataset.bgTone, "warm");
  assert.equal(app.snapshot(), "warm");
  assert.ok(app.changed() > 0);
});

test("background tone can still change in current tab when storage is blocked", () => {
  const app = setup({ blocked: true });
  const [, warmBtn] = app.buttons();
  warmBtn.props.onClick();

  assert.equal(app.document.documentElement.dataset.bgTone, "warm");
  assert.equal(app.snapshot(), "warm");
});
