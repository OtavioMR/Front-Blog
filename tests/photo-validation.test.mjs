import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadPhoto, validatePhoto } from "../src/app/conta/foto/photo-upload.ts";

test("foto aceita formatos e limites previstos pelo backend", () => {
  assert.equal(validatePhoto({ size: 5 * 1024 * 1024, type: "image/webp" }), null);
  assert.match(validatePhoto({ size: 5 * 1024 * 1024 + 1, type: "image/png" }), /5 MiB/);
  assert.match(validatePhoto({ size: 0, type: "image/jpeg" }), /5 MiB/);
  assert.match(validatePhoto({ size: 1, type: "image/svg+xml" }), /JPEG/);
});

test("envio multipart usa campo file, valida limite e interpreta resultados com segurança", async () => {
  const subject = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const file = new File(["imagem simulada"], "foto.png", { type: "image/png" });
  let calls = 0;
  const send = async (id, path, init) => {
    calls++;
    assert.equal(id, subject);
    assert.equal(path, `/api/v1/users/${subject}/profile-photo`);
    assert.equal(init.method, "POST");
    assert.ok(init.body instanceof FormData);
    assert.deepEqual([...init.body.keys()], ["file"]);
    const attached = init.body.get("file");
    assert.equal(attached.name, "foto.png");
    assert.equal(attached.type, "image/png");
    assert.equal(await attached.text(), "imagem simulada");
    assert.equal(init.headers, undefined); // O navegador define o boundary multipart.
    return Response.json({ id: subject, profilePhoto: "/uploads/profile-photos/abc-123.webp" });
  };
  assert.deepEqual(await uploadPhoto(subject, file, send), { kind: "success", profilePhoto: "/uploads/profile-photos/abc-123.webp" });
  const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" });
  assert.equal((await uploadPhoto(subject, oversized, send)).kind, "invalid");
  assert.equal(calls, 1);
  assert.equal((await uploadPhoto(subject, file, async () => new Response(null, { status: 401 }))).kind, "signed-out");
  assert.equal((await uploadPhoto(subject, file, async () => new Response(null, { status: 409 }))).kind, "account-changed");
  assert.equal((await uploadPhoto(subject, file, async () => { throw new Error("conexão interrompida"); })).kind, "uncertain");
  assert.equal((await uploadPhoto(subject, file, async () => Response.json({ id: "outra conta", profilePhoto: "/uploads/profile-photos/abc.webp" }))).kind, "uncertain");
});
