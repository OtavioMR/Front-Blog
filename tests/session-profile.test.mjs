import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { uploadPhoto } from "../src/app/conta/foto/photo-upload.ts";

test("perfil é consultado com bearer e falhas não exibem dados de outra conta", async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (_name, action) => action() } } });
  globalThis.window = { location: { origin: "http://localhost:3000" } };
  globalThis.BroadcastChannel = class { postMessage() {} };
  const id = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const otherId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const access = `e30.${Buffer.from(JSON.stringify({ sub: id })).toString("base64url")}.signature`;
  const otherAccess = `e30.${Buffer.from(JSON.stringify({ sub: otherId })).toString("base64url")}.signature`;
  let loginAccess = access;
  let mutationCount = 0;
  let profileStatus = 200;
  let profileId = id;
  globalThis.fetch = async (path, init) => {
    if (path === "/api/v1/auth/login") return Response.json({ access_token: loginAccess, token_type: "Bearer", expires_in: 900, session_id: '00000000-0000-4000-8000-000000000001', refresh_protocol: 2, refresh_generation: 0 });
    if (path === "/api/v1/users/me/author" && init.method === "POST") { mutationCount++; return Response.json({ role: "AUTHOR", rulesVersion: "1" }); }
    if (path.startsWith("/api/v1/posts/me?")) { mutationCount++; return Response.json({ data: [] }); }
    if (path.startsWith("/api/v1/auth/sessions/") && init.method === "DELETE") { mutationCount++; return new Response(null, { status: 204 }); }
    if (path === `/api/v1/users/${id}` && init.method === "PATCH") { mutationCount++; return new Response(null, { status: 204 }); }
    if (path === `/api/v1/users/${id}`) {
      assert.equal(init.headers.get("Authorization"), `Bearer ${access}`);
      assert.equal(init.cache, "no-store");
      assert.equal(init.credentials, "omit");
      if (profileStatus !== 200) return new Response(null, { status: profileStatus });
      return Response.json({ id: profileId, name: "Pessoa de teste", email: "teste@example.test", role: "READER", emailVerified: true, bio: null });
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const source = await readFile(new URL("../src/lib/session-client.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const client = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  await client.login("teste@example.test", "senha de teste", "");
  assert.equal((await client.getOwnProfile()).name, "Pessoa de teste");
  profileId = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  await assert.rejects(client.getOwnProfile(), /perfil inválida/);
  profileStatus = 503;
  await assert.rejects(client.getOwnProfile(), /carregar seu perfil/);
  await assert.rejects(client.authenticatedFetch("/api/v1/../other"), /inválido/);
  loginAccess = otherAccess;
  await client.login("outra@example.test", "senha de teste", "");
  const denied = await client.authenticatedFetchForSubject(id, `/api/v1/users/${id}`, { method: "PATCH" });
  assert.equal(denied.status, 409);
  assert.equal(mutationCount, 0);
  const revoked = await client.authenticatedFetchForSubject(id, "/api/v1/auth/sessions/4c781e0d-b963-493c-b2df-0a8fa66c0615", { method: "DELETE" });
  assert.equal(revoked.status, 409);
  assert.equal(mutationCount, 0);
  const acceptance = await client.authenticatedFetchForSubject(id, "/api/v1/users/me/author", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: "1", accepted: true }) });
  const articles = await client.authenticatedFetchForSubject(id, "/api/v1/posts/me?page=1&limit=10");
  assert.equal(acceptance.status, 409);
  assert.equal(articles.status, 409);
  assert.equal(mutationCount, 0);
  const photo = new File(["foto"], "foto.png", { type: "image/png" });
  const upload = await uploadPhoto(id, photo, client.authenticatedFetchForSubject);
  assert.equal(upload.kind, "account-changed");
  assert.equal(mutationCount, 0);
});
