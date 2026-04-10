import { describe, expect, it } from "vitest";
import {
  checkAuditResolutionGate,
  checkBibleVersioningGate,
  checkChunkReviewGate,
  checkCompileGate,
  checkSceneCompletionGate,
  checkScenePlanGate,
} from "../../src/gates/index.js";
import {
  type AuditFlag,
  type Chunk,
  createEmptyBible,
  createEmptyScenePlan,
  type LintResult,
  type ScenePlan,
} from "../../src/types/index.js";

// ─── Helpers ───────────────────────────────────────

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("test"),
    title: "The Bar",
    povCharacterId: "marcus",
    narrativeGoal: "Establish tension",
    failureModeToAvoid: "Stated emotions",
    ...overrides,
  };
}

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

// ─── Gate 1: Scene Plan Gate ───────────────────────

describe("checkScenePlanGate", () => {
  it("passes with all required fields", () => {
    const result = checkScenePlanGate(makePlan());
    expect(result.passed).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it("fails when title is empty", () => {
    const result = checkScenePlanGate(makePlan({ title: "" }));
    expect(result.passed).toBe(false);
    expect(result.messages).toContain("Section title is required.");
  });

  it("fails when author voice is missing", () => {
    const result = checkScenePlanGate(makePlan({ povCharacterId: "" }));
    expect(result.passed).toBe(false);
    expect(result.messages).toContain("Author voice must be selected.");
  });

  it("fails when section goal is missing", () => {
    const result = checkScenePlanGate(makePlan({ narrativeGoal: "" }));
    expect(result.passed).toBe(false);
    expect(result.messages).toContain("Section goal is required.");
  });

  it("fails when failure mode is missing", () => {
    const result = checkScenePlanGate(makePlan({ failureModeToAvoid: "" }));
    expect(result.passed).toBe(false);
    expect(result.messages).toContain("Failure mode to avoid is required.");
  });

  it("accumulates all missing fields", () => {
    const result = checkScenePlanGate(
      makePlan({ title: "", povCharacterId: "", narrativeGoal: "", failureModeToAvoid: "" }),
    );
    expect(result.passed).toBe(false);
    expect(result.messages).toHaveLength(4);
  });

  it("rejects whitespace-only fields", () => {
    const result = checkScenePlanGate(makePlan({ title: "   " }));
    expect(result.passed).toBe(false);
  });
});

// ─── Gate 2: Compile Gate ──────────────────────────

describe("checkCompileGate", () => {
  it("passes with no issues", () => {
    const result = checkCompileGate({ issues: [] });
    expect(result.passed).toBe(true);
  });

  it("passes with warnings only", () => {
    const lint: LintResult = {
      issues: [{ code: "R3_STARVED", severity: "warning", message: "Ring 3 low" }],
    };
    const result = checkCompileGate(lint);
    expect(result.passed).toBe(true);
  });

  it("passes with info only", () => {
    const lint: LintResult = {
      issues: [{ code: "EMPTY_KILL_LIST", severity: "info", message: "No kill list" }],
    };
    const result = checkCompileGate(lint);
    expect(result.passed).toBe(true);
  });

  it("fails with lint errors", () => {
    const lint: LintResult = {
      issues: [{ code: "R1_OVER_CAP", severity: "error", message: "Ring 1 too large" }],
    };
    const result = checkCompileGate(lint);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("R1_OVER_CAP");
  });

  it("collects all errors", () => {
    const lint: LintResult = {
      issues: [
        { code: "R1_OVER_CAP", severity: "error", message: "Ring 1 too large" },
        { code: "POV_CHAR_MISSING", severity: "error", message: "No POV" },
        { code: "R3_STARVED", severity: "warning", message: "Ring 3 low" },
      ],
    };
    const result = checkCompileGate(lint);
    expect(result.passed).toBe(false);
    expect(result.messages).toHaveLength(2); // only errors, not warnings
  });
});

// ─── Gate 3: Chunk Review Gate ─────────────────────

describe("checkChunkReviewGate", () => {
  it("passes for accepted chunk", () => {
    const result = checkChunkReviewGate(makeChunk({ status: "accepted" }));
    expect(result.passed).toBe(true);
  });

  it("passes for edited chunk", () => {
    const result = checkChunkReviewGate(makeChunk({ status: "edited" }));
    expect(result.passed).toBe(true);
  });

  it("fails for pending chunk", () => {
    const result = checkChunkReviewGate(makeChunk({ status: "pending" }));
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("pending");
  });

  it("fails for rejected chunk", () => {
    const result = checkChunkReviewGate(makeChunk({ status: "rejected" }));
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("rejected");
  });
});

// ─── Gate 4: Scene Completion Gate ─────────────────

describe("checkSceneCompletionGate", () => {
  it("passes when all chunks present and reviewed", () => {
    const plan = makePlan({ chunkCount: 2 });
    const chunks = [
      makeChunk({ sequenceNumber: 0, status: "accepted" }),
      makeChunk({ sequenceNumber: 1, status: "edited" }),
    ];
    const result = checkSceneCompletionGate(chunks, plan);
    expect(result.passed).toBe(true);
  });

  it("fails when too few chunks", () => {
    const plan = makePlan({ chunkCount: 3 });
    const chunks = [makeChunk({ sequenceNumber: 0, status: "accepted" })];
    const result = checkSceneCompletionGate(chunks, plan);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("1 of 3");
  });

  it("fails when a chunk is not reviewed", () => {
    const plan = makePlan({ chunkCount: 2 });
    const chunks = [
      makeChunk({ sequenceNumber: 0, status: "accepted" }),
      makeChunk({ sequenceNumber: 1, status: "pending" }),
    ];
    const result = checkSceneCompletionGate(chunks, plan);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("pending");
  });

  it("accumulates both missing chunk and unreviewed chunk messages", () => {
    const plan = makePlan({ chunkCount: 3 });
    const chunks = [makeChunk({ sequenceNumber: 0, status: "pending" })];
    const result = checkSceneCompletionGate(chunks, plan);
    expect(result.passed).toBe(false);
    expect(result.messages).toHaveLength(2); // missing count + unreviewed
  });
});

// ─── Gate 5: Audit Resolution Gate ─────────────────

describe("checkAuditResolutionGate", () => {
  it("passes with no flags", () => {
    const result = checkAuditResolutionGate([]);
    expect(result.passed).toBe(true);
  });

  it("passes with only warning/info flags (even unresolved)", () => {
    const flags = [makeFlag({ severity: "warning", resolved: false }), makeFlag({ severity: "info", resolved: false })];
    const result = checkAuditResolutionGate(flags);
    expect(result.passed).toBe(true);
  });

  it("passes when critical flags are resolved", () => {
    const flags = [makeFlag({ severity: "critical", resolved: true })];
    const result = checkAuditResolutionGate(flags);
    expect(result.passed).toBe(true);
  });

  it("fails with unresolved critical flag", () => {
    const flags = [
      makeFlag({ severity: "critical", resolved: false, category: "voice-drift", message: "Tone shifted" }),
    ];
    const result = checkAuditResolutionGate(flags);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("voice-drift");
  });

  it("collects all unresolved critical flags", () => {
    const flags = [
      makeFlag({ id: "f1", severity: "critical", resolved: false }),
      makeFlag({ id: "f2", severity: "critical", resolved: false }),
      makeFlag({ id: "f3", severity: "critical", resolved: true }),
    ];
    const result = checkAuditResolutionGate(flags);
    expect(result.passed).toBe(false);
    expect(result.messages).toHaveLength(2);
  });
});

// ─── Gate 6: Bible Versioning Gate ─────────────────

describe("checkBibleVersioningGate", () => {
  it("passes when bible is at latest version", () => {
    const bible = createEmptyBible("test");
    bible.version = 3;
    const result = checkBibleVersioningGate(bible, 3);
    expect(result.passed).toBe(true);
  });

  it("passes when bible is ahead of latest (edge case)", () => {
    const bible = createEmptyBible("test");
    bible.version = 5;
    const result = checkBibleVersioningGate(bible, 3);
    expect(result.passed).toBe(true);
  });

  it("fails when bible is behind latest version", () => {
    const bible = createEmptyBible("test");
    bible.version = 1;
    const result = checkBibleVersioningGate(bible, 3);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("version 1");
    expect(result.messages[0]).toContain("latest is 3");
  });
});
