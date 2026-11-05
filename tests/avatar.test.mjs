import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup(image = null) {
  let failed = null;
  let effect;
  const source = readFileSync(new URL("../src/app/_components/avatar.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports = {};
  const require = name => name === "react" ? { useState: () => [failed, value => { failed = value; }], useRef: () => ({ current: image }), useEffect: fn => { effect = fn; } } : name === "react/jsx-runtime" ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } : { __esModule: true, default: { avatar: "avatar" } };
  vm.runInNewContext(compiled, { exports, require });
  return { ...exports, runEffect: () => effect?.() };
}

test("avatar não carrega foto ausente ou inválida e usa iniciais ou ícone", () => {
  const avatar = setup();
  assert.equal(avatar.default({ name: "Ana Silva", src: null }).props.children, "AS");
  assert.equal(avatar.default({ name: "Ana Silva", src: "https://invalid.example/photo.png" }).props.children, "AS");
  assert.equal(avatar.default({ name: "" }).props.children.type, "svg");
});

test("imagem que falhou antes da hidratação também usa fallback", () => {
  const avatar = setup({ complete: true, naturalWidth: 0 });
  const props = { name: "Ana Silva", src: "/uploads/profile-photos/abc-123.webp" };
  assert.equal(avatar.default(props).props.children.type, "img");
  avatar.runEffect();
  assert.equal(avatar.default(props).props.children, "AS");
});

test("imagem quebrada usa fallback e nova URL pode ser carregada", () => {
  const avatar = setup();
  const path = "/uploads/profile-photos/abc-123.webp";
  const image = avatar.default({ name: "Ana Silva", src: path }).props.children;
  assert.equal(image.type, "img");
  image.props.onError();
  assert.equal(avatar.default({ name: "Ana Silva", src: path }).props.children, "AS");
  assert.equal(avatar.default({ name: "Ana Silva", src: "/uploads/profile-photos/def-456.webp" }).props.children.type, "img");
});
