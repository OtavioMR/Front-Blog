import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("fluxo editorial exige ativação explícita", async () => {
  const source = await readFile(new URL("../src/app/studio/editorial-config.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { editorialWorkflowEnabled } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const previous = process.env.EDITORIAL_WORKFLOW_ENABLED;
  try {
    delete process.env.EDITORIAL_WORKFLOW_ENABLED;
    assert.equal(editorialWorkflowEnabled(), false);
    process.env.EDITORIAL_WORKFLOW_ENABLED = "false";
    assert.equal(editorialWorkflowEnabled(), false);
    process.env.EDITORIAL_WORKFLOW_ENABLED = "true";
    assert.equal(editorialWorkflowEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.EDITORIAL_WORKFLOW_ENABLED;
    else process.env.EDITORIAL_WORKFLOW_ENABLED = previous;
  }
});
