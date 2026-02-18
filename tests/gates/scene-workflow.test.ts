import { describe, it, expect } from "vitest";
import {
  checkSceneCompletionGate,
  checkAuditResolutionGate,
  checkScenePlanGate,
} from "../../src/gates/index.js";
import {
  createEmptyScenePlan,
  type ScenePlan,
  type Chunk,
  type AuditFlag,
} from "../../src/types/index.js";

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("test"),
    title: "Scene One",
    povCharacterId: "marcus",
    narrativeGoal: "Build tension",
    failureModeToAvoid: "Stated emotions",
    chunkCount: 3,
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
    category: "kill_list",
    message: "Found banned phrase",
    lineReference: null,
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

describe("scene workflow gates", () => {
  describe("scene completion flow", () => {
    it("scene cannot complete with fewer chunks than planned", () => {
      const plan = makePlan({ chunkCount: 3 });
      const chunks = [
        makeChunk({ sequenceNumber: 0 }),
        makeChunk({ sequenceNumber: 1 }),
      ];
      const result = checkSceneCompletionGate(chunks, plan);
      expect(result.passed).toBe(false);
    });

    it("scene cannot complete with unreviewed chunks", () => {
      const plan = makePlan({ chunkCount: 2 });
      const chunks = [
        makeChunk({ sequenceNumber: 0, status: "accepted" }),
        makeChunk({ sequenceNumber: 1, status: "pending" }),
      ];
      const result = checkSceneCompletionGate(chunks, plan);
      expect(result.passed).toBe(false);
    });

    it("scene can complete when all chunks reviewed", () => {
      const plan = makePlan({ chunkCount: 2 });
      const chunks = [
        makeChunk({ sequenceNumber: 0, status: "accepted" }),
        makeChunk({ sequenceNumber: 1, status: "edited" }),
      ];
      const result = checkSceneCompletionGate(chunks, plan);
      expect(result.passed).toBe(true);
    });

    it("scene cannot complete with unresolved critical audit flags", () => {
      const flags = [
        makeFlag({ severity: "critical", resolved: false }),
      ];
      const result = checkAuditResolutionGate(flags);
      expect(result.passed).toBe(false);
    });

    it("scene can complete with resolved critical flags", () => {
      const flags = [
        makeFlag({ severity: "critical", resolved: true, wasActionable: true, resolvedAction: "Fixed" }),
      ];
      const result = checkAuditResolutionGate(flags);
      expect(result.passed).toBe(true);
    });

    it("scene can complete with unresolved non-critical flags", () => {
      const flags = [
        makeFlag({ severity: "warning", resolved: false }),
        makeFlag({ severity: "info", resolved: false }),
      ];
      const result = checkAuditResolutionGate(flags);
      expect(result.passed).toBe(true);
    });
  });

  describe("scene plan validation before drafting", () => {
    it("blocks drafting without required plan fields", () => {
      const result = checkScenePlanGate(makePlan({ title: "", narrativeGoal: "" }));
      expect(result.passed).toBe(false);
      expect(result.messages).toHaveLength(2);
    });

    it("allows drafting with all required fields", () => {
      const result = checkScenePlanGate(makePlan());
      expect(result.passed).toBe(true);
    });
  });
});
