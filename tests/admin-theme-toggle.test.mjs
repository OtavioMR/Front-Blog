import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup({ blocked = false, cookie = "", initialTheme = "system", prefersDark = false } = {}) {
  const listeners = new Map();
  const values = new Map();
  const cookies = new Map();
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, v] = part.trim().split("=");
      if (k) cookies.set(k, v);
    }
  }

  const document = {
    documentElement: { dataset: {} },
    get cookie() {
      return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(val) {
      const [pair] = val.split(";");
      const [k, v] = pair.trim().split("=");
      if (k) cookies.set(k, v);
    }
  };

  const localStorage = {
    getItem(key) { if (blocked) throw Error("blocked"); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error("blocked"); values.set(key, value); },
    removeItem(key) { if (blocked) throw Error("blocked"); values.delete(key); },
  };

  const window = {
    location: { protocol: "http:" },
    addEventListener(name, fn) { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
    matchMedia(query) {
      return {
        matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
        addEventListener() {},
        removeEventListener() {}
      };
    }
  };

  const source = readFileSync(new URL("../src/app/gestao-editorial/(painel)/_components/admin-theme-toggle.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};

  const require = name => {
    if (name === "react") {
      return {
        useSyncExternalStore(subscribe, getSnapshot) {
          return getSnapshot();
        }
      };
    }
    if (name === "react/jsx-runtime") {
      return {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props })
      };
    }
    if (name === "./icons") {
      return {
        IconMoon: (props) => ({ type: "IconMoon", props }),
        IconSun: (props) => ({ type: "IconSun", props })
      };
    }
    return { default: {} };
  };

  vm.runInNewContext(compiled, {
    exports,
    require,
    window,
    document,
    localStorage,
    Event: class { constructor(type) { this.type = type; } }
  });

  const render = (props = { initialTheme }) => exports.AdminThemeToggle(props);
  return { values, cookies, document, window, render, exports };
}

test("AdminThemeToggle isolates admin theme from public blog theme (entrelinhas-theme)", () => {
  const app = setup();
  const btn = app.render();
  btn.props.onClick();

  assert.equal(app.values.has("entrelinhas-theme"), false, "public theme must remain untouched");
  assert.ok(app.values.has("admin-theme"), "admin theme must be stored under admin-theme");
  assert.ok(app.cookies.has("admin-theme"), "admin theme must be persisted to cookies");
});

test("AdminThemeToggle toggles theme between light and dark and updates dataset.theme", () => {
  const app = setup();
  assert.equal(app.document.documentElement.dataset.theme, undefined);

  app.render().props.onClick();
  const first = app.document.documentElement.dataset.theme;
  assert.ok(["light", "dark"].includes(first));
  assert.equal(app.values.get("admin-theme"), first);

  app.render().props.onClick();
  const second = app.document.documentElement.dataset.theme;
  assert.ok(["light", "dark"].includes(second));
  assert.notEqual(first, second);
  assert.equal(app.values.get("admin-theme"), second);
});

test("AdminThemeToggle respects server cookie during SSR hydration", () => {
  const app = setup({ cookie: "admin-theme=dark", initialTheme: "dark" });
  assert.equal(app.exports.getAdminTheme(), "dark");
});

test("AdminThemeToggle handles restricted localStorage gracefully", () => {
  const app = setup({ blocked: true });
  app.render().props.onClick();
  assert.ok(["light", "dark"].includes(app.document.documentElement.dataset.theme));
});
