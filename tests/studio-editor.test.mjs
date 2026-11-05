import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("editor aceita somente rascunhos da conta e confirmação PENDING válida", async () => {
  const source = await readFile(new URL("../src/app/studio/editor-contracts.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { parseDraft, parseUpdatedDraft, isPendingResponse } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const owner = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const draft = { id: "d28beb9c-6a69-4c3a-841c-7593a8a63265", authorId: owner, title: "Título", content: "Conteúdo de teste", published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  assert.deepEqual(parseDraft(draft, owner), draft);
  const { isActive: _active, ...patchResponse } = draft;
  assert.throws(() => parseDraft(patchResponse, owner));
  assert.equal(parseUpdatedDraft(patchResponse, owner).isActive, true);
  assert.throws(() => parseUpdatedDraft({ ...draft, isActive: false }, owner));
  assert.throws(() => parseUpdatedDraft(patchResponse, "other"));
  assert.equal(parseUpdatedDraft(patchResponse, "other", true).id, draft.id);
  assert.throws(() => parseDraft({ ...draft, authorId: "outra" }, owner));
  assert.throws(() => parseDraft({ ...draft, reviewStatus: "UNKNOWN" }, owner));
  assert.throws(() => parseDraft({ ...draft, id: "../invalido" }, owner));
  assert.equal(parseDraft({ ...draft, scheduledAt: "2099-01-01T12:00:00.000Z" }, owner).scheduledAt, "2099-01-01T12:00:00.000Z");
  assert.throws(() => parseDraft({ ...draft, scheduledAt: undefined }, owner));
  assert.throws(() => parseDraft({ ...draft, scheduledAt: "sem data" }, owner));
  assert.equal(isPendingResponse({ status: "PENDING" }), true);
  assert.equal(isPendingResponse({ status: "APPROVED" }), false);
});


test("review eligibility requires the unapproved author and handles missing approval", async () => {
  const source = await readFile(new URL("../src/app/studio/editor-contracts.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { reviewEligibility } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  assert.equal(reviewEligibility("AUTHOR", "author", "author", false), "eligible");
  assert.equal(reviewEligibility("AUTHOR", "author", "author", true), "ineligible");
  assert.equal(reviewEligibility("AUTHOR", "author", "author", undefined), "unknown");
  assert.equal(reviewEligibility("AUTHOR", "author", "other", false), "ineligible");
  assert.equal(reviewEligibility("ADMIN", "author", "author", false), "ineligible");
  assert.equal(reviewEligibility("READER", "author", "author", false), "ineligible");
});


test("publication requires an approved owner and validates the resulting state", async () => {
  const source = await readFile(new URL("../src/app/studio/editor-contracts.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { publicationEligibility, parsePublicationResponse } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  assert.equal(publicationEligibility("AUTHOR", "a", "a", true), "eligible");
  assert.equal(publicationEligibility("ADMIN", "a", "a", true), "eligible");
  assert.equal(publicationEligibility("AUTHOR", "a", "a", false), "ineligible");
  assert.equal(publicationEligibility("AUTHOR", "a", "a", undefined), "unknown");
  assert.equal(publicationEligibility("ADMIN", "a", "b", true), "ineligible");
  const owner = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const id = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const draft = { id, authorId: owner, title: "Title", content: "Test content", published: true, isActive: true, reviewStatus: "DRAFT", scheduledAt: null };
  assert.equal(parsePublicationResponse(draft, owner, id, true).published, true);
  const { isActive: _active, ...patchResponse } = draft;
  assert.equal(parsePublicationResponse(patchResponse, owner, id, true).isActive, true);
  assert.throws(() => parsePublicationResponse({ ...draft, isActive: false }, owner, id, true));
  assert.equal(parsePublicationResponse({ ...draft, published: false }, owner, id, false).published, false);
  assert.throws(() => parsePublicationResponse({ ...draft, published: false }, owner, id, true));
  assert.throws(() => parsePublicationResponse({ ...draft, authorId: "other" }, owner, id, true));
  assert.throws(() => parsePublicationResponse({ ...draft, reviewStatus: "PENDING" }, owner, id, true));
  assert.throws(() => parsePublicationResponse({ ...draft, scheduledAt: "2099-01-01T12:00:00Z" }, owner, id, true));
});


test("schedule conversion validates local dates and API response", async () => {
  const source = await readFile(new URL("../src/app/studio/editor-contracts.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { scheduleToIso, parseScheduleResponse } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const iso = scheduleToIso("2099-07-01T12:30", 0);
  assert.equal(iso, new Date("2099-07-01T12:30").toISOString());
  assert.equal(scheduleToIso("2000-01-01T12:30", Date.now()), null);
  assert.equal(scheduleToIso("2099-02-30T12:30", 0), null);
  assert.equal(scheduleToIso("2099-01-01T12:30Z", 0), null);
  const owner = "4c781e0d-b963-493c-b2df-0a8fa66c0615";
  const id = "d28beb9c-6a69-4c3a-841c-7593a8a63265";
  const draft = { id, authorId: owner, title: "Title", content: "Test content", published: false, isActive: true, reviewStatus: "DRAFT", scheduledAt: iso };
  assert.equal(parseScheduleResponse(draft, owner, id, iso).scheduledAt, iso);
  const { isActive: _active, ...patchResponse } = draft;
  assert.equal(parseScheduleResponse(patchResponse, owner, id, iso).scheduledAt, iso);
  assert.throws(() => parseScheduleResponse({ ...draft, isActive: false }, owner, id, iso));
  assert.equal(parseScheduleResponse({ ...draft, scheduledAt: null }, owner, id, null).scheduledAt, null);
  assert.throws(() => parseScheduleResponse(draft, owner, id, null));
  assert.throws(() => parseScheduleResponse({ ...draft, published: true }, owner, id, iso));
  assert.throws(() => parseScheduleResponse({ ...draft, reviewStatus: "PENDING" }, owner, id, iso));
  assert.throws(() => parseScheduleResponse({ ...draft, authorId: "other" }, owner, id, iso));
});
