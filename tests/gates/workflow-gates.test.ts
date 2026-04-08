import { describe, expect, it } from "vitest";
import {
  checkAuditToCompleteGate,
  checkBootstrapToPlanGate,
  checkCompleteToExportGate,
  checkDraftToAuditGate,
  checkPlanToDraftGate,
} from "../../src/gates/index.js";
import {
  type AuditFlag,
  type Chunk,
  createEmptyBible,
  createEmptyCharacterDossier,
  createEmptyScenePlan,
} from "../../src/types/index.js";

// ─── Helpers ───────────────────────────────────────

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "c1",
    sceneId: "s1",
    sequenceNumber: 0,
    generatedText: "Some text.",
    payloadHash: "hash",
    model: "test",
    temperature: 0.8,
    topP: 0.92,
    generatedAt: new Date().toISOString(),
    status: "accepted",
    editedText: null,
    humanNotes: null,
    ...overrides,
  };
}

function makeFlag(overrides: Partial<AuditFlag> = {}): AuditFlag {
  return {
    id: "f1",
    sceneId: "s1",
    severity: "warning",
    category: "kill-list",
    message: "Found banned phrase",
    lineReference: null,
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

// ─── Bootstrap → Plan ────────────────────────────────

describe("checkBootstrapToPlanGate", () => {
  it("fails when bible is null", () => {
    const result = checkBootstrapToPlanGate(null);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toMatch(/brief/i);
  });

  it("fails when bible has no characters", () => {
    const bible = createEmptyBible("test");
    const result = checkBootstrapToPlanGate(bible);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toMatch(/voice/i);
  });

  it("passes with bible + 1 character", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    const result = checkBootstrapToPlanGate(bible);
    expect(result.passed).toBe(true);
  });
});

// ─── Plan → Draft ────────────────────────────────────

describe("checkPlanToDraftGate", () => {
  it("fails with no scenes", () => {
    const result = checkPlanToDraftGate([]);
    expect(result.passed).toBe(false);
  });

  it("fails when scene has no title", () => {
    const plan = createEmptyScenePlan("test");
    plan.narrativeGoal = "Some goal";
    const result = checkPlanToDraftGate([plan]);
    expect(result.passed).toBe(false);
  });

  it("fails when scene has no narrative goal", () => {
    const plan = createEmptyScenePlan("test");
    plan.title = "A title";
    const result = checkPlanToDraftGate([plan]);
    expect(result.passed).toBe(false);
  });

  it("passes with 1 scene that has title + narrativeGoal", () => {
    const plan = createEmptyScenePlan("test");
    plan.title = "Opening Scene";
    plan.narrativeGoal = "Establish the world";
    const result = checkPlanToDraftGate([plan]);
    expect(result.passed).toBe(true);
  });
});

// ─── Draft → Audit ───────────────────────────────────

describe("checkDraftToAuditGate", () => {
  it("fails with no chunks", () => {
    const result = checkDraftToAuditGate({});
    expect(result.passed).toBe(false);
  });

  it("fails with empty chunk arrays", () => {
    const result = checkDraftToAuditGate({ s1: [] });
    expect(result.passed).toBe(false);
  });

  it("passes with at least 1 chunk", () => {
    const result = checkDraftToAuditGate({ s1: [makeChunk()] });
    expect(result.passed).toBe(true);
  });
});

// ─── Audit → Complete ────────────────────────────────

describe("checkAuditToCompleteGate", () => {
  it("passes with no flags", () => {
    const result = checkAuditToCompleteGate([]);
    expect(result.passed).toBe(true);
  });

  it("passes with resolved critical flags", () => {
    const result = checkAuditToCompleteGate([makeFlag({ severity: "critical", resolved: true })]);
    expect(result.passed).toBe(true);
  });

  it("passes with unresolved non-critical flags", () => {
    const result = checkAuditToCompleteGate([makeFlag({ severity: "warning", resolved: false })]);
    expect(result.passed).toBe(true);
  });

  it("fails with unresolved critical flags", () => {
    const result = checkAuditToCompleteGate([makeFlag({ severity: "critical", resolved: false })]);
    expect(result.passed).toBe(false);
  });
});

// ─── Complete → Export ───────────────────────────────

describe("checkCompleteToExportGate", () => {
  it("fails with no scenes", () => {
    const result = checkCompleteToExportGate([]);
    expect(result.passed).toBe(false);
  });

  it("fails with only planned/drafting scenes", () => {
    const result = checkCompleteToExportGate([{ status: "planned" }, { status: "drafting" }]);
    expect(result.passed).toBe(false);
  });

  it("passes with at least 1 complete scene", () => {
    const result = checkCompleteToExportGate([{ status: "drafting" }, { status: "complete" }]);
    expect(result.passed).toBe(true);
  });
});
