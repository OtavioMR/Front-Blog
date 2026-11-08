import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("sistema centralizado de permissões frontend (capacidades e hierarquia)", async () => {
  const source = await readFile(new URL("../src/lib/permissions.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const {
    Capability,
    hasCapability,
    roleSatisfies,
    canWriteArticles,
    canManageSeries,
    canAccessAdmin,
    canManageRoles,
    formatRoleName,
  } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

  // READER
  assert.equal(hasCapability("READER", Capability.COMMENT_CREATE), true);
  assert.equal(hasCapability("READER", Capability.ARTICLE_CREATE), false);
  assert.equal(hasCapability("READER", Capability.ADMIN_ACCESS), false);
  assert.equal(canWriteArticles("READER"), false);
  assert.equal(canAccessAdmin("READER"), false);

  // AUTHOR
  assert.equal(hasCapability("AUTHOR", Capability.COMMENT_CREATE), true);
  assert.equal(hasCapability("AUTHOR", Capability.ARTICLE_CREATE), true);
  assert.equal(hasCapability("AUTHOR", Capability.ARTICLE_EDIT_OWN), true);
  assert.equal(hasCapability("AUTHOR", Capability.ARTICLE_PUBLISH_OWN), true);
  assert.equal(hasCapability("AUTHOR", Capability.ADMIN_ACCESS), false);
  assert.equal(canWriteArticles("AUTHOR"), true);
  assert.equal(canManageSeries("AUTHOR"), true);
  assert.equal(canAccessAdmin("AUTHOR"), false);

  // ADMIN
  assert.equal(hasCapability("ADMIN", Capability.ARTICLE_CREATE), true);
  assert.equal(hasCapability("ADMIN", Capability.ADMIN_ACCESS), true);
  assert.equal(hasCapability("ADMIN", Capability.ADMIN_MODERATE), true);
  assert.equal(hasCapability("ADMIN", Capability.ADMIN_MANAGE_USERS), true);
  assert.equal(hasCapability("ADMIN", Capability.SUPERADMIN_MANAGE_ROLES), false);
  assert.equal(canWriteArticles("ADMIN"), true);
  assert.equal(canAccessAdmin("ADMIN"), true);
  assert.equal(canManageRoles("ADMIN"), false);

  // SUPER_ADMIN
  assert.equal(hasCapability("SUPER_ADMIN", Capability.ARTICLE_CREATE), true);
  assert.equal(hasCapability("SUPER_ADMIN", Capability.ARTICLE_EDIT_OWN), true);
  assert.equal(hasCapability("SUPER_ADMIN", Capability.ADMIN_ACCESS), true);
  assert.equal(hasCapability("SUPER_ADMIN", Capability.ADMIN_MODERATE), true);
  assert.equal(hasCapability("SUPER_ADMIN", Capability.SUPERADMIN_MANAGE_ROLES), true);
  assert.equal(canWriteArticles("SUPER_ADMIN"), true);
  assert.equal(canManageSeries("SUPER_ADMIN"), true);
  assert.equal(canAccessAdmin("SUPER_ADMIN"), true);
  assert.equal(canManageRoles("SUPER_ADMIN"), true);

  // Hierarquia
  assert.equal(roleSatisfies("SUPER_ADMIN", "ADMIN"), true);
  assert.equal(roleSatisfies("SUPER_ADMIN", "AUTHOR"), true);
  assert.equal(roleSatisfies("SUPER_ADMIN", "READER"), true);
  assert.equal(roleSatisfies("ADMIN", "AUTHOR"), true);
  assert.equal(roleSatisfies("ADMIN", "SUPER_ADMIN"), false);
  assert.equal(roleSatisfies("AUTHOR", "ADMIN"), false);

  // Formatação
  assert.equal(formatRoleName("SUPER_ADMIN"), "Superadministrador");
  assert.equal(formatRoleName("ADMIN"), "Administrador");
  assert.equal(formatRoleName("AUTHOR"), "Autor");
  assert.equal(formatRoleName("READER"), "Leitor");
});
