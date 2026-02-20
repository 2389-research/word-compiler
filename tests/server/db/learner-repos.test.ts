import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import * as editPatternsRepo from "../../../server/db/repositories/edit-patterns.js";
import * as learnedPatternsRepo from "../../../server/db/repositories/learned-patterns.js";
import * as projects from "../../../server/db/repositories/projects.js";
import { createSchema } from "../../../server/db/schema.js";
import type { EditPattern } from "../../../src/learner/diff.js";
import type { PatternData } from "../../../src/learner/patterns.js";
import { generateId } from "../../../src/types/index.js";

let db: Database.Database;

function makeEditPattern(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: generateId(),
    chunkId: "chunk-1",
    sceneId: "scene-1",
    projectId: "proj-1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "um well",
    editedText: "",
    context: "Before. ... After.",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  db = new Database(":memory:");
  createSchema(db);
  // Seed a project for FK constraints
  projects.createProject(db, { id: "proj-1", title: "Test Project", status: "drafting", createdAt: "", updatedAt: "" });
});

describe("edit-patterns repository", () => {
  it("creates and lists edit patterns", () => {
    const patterns = [makeEditPattern(), makeEditPattern({ id: generateId(), subType: "TONE_SHIFT" })];
    editPatternsRepo.createEditPatterns(db, patterns);
    const result = editPatternsRepo.listEditPatterns(db, "proj-1");
    expect(result).toHaveLength(2);
    expect(result[0]!.editType).toBe("DELETION");
    expect(result[0]!.subType).toBe("CUT_FILLER");
    expect(result[0]!.originalText).toBe("um well");
  });

  it("returns empty for non-existent project", () => {
    expect(editPatternsRepo.listEditPatterns(db, "no-such")).toEqual([]);
  });

  it("lists by scene", () => {
    const p1 = makeEditPattern({ sceneId: "s1" });
    const p2 = makeEditPattern({ id: generateId(), sceneId: "s2" });
    editPatternsRepo.createEditPatterns(db, [p1, p2]);
    const result = editPatternsRepo.listEditPatternsForScene(db, "s1");
    expect(result).toHaveLength(1);
    expect(result[0]!.sceneId).toBe("s1");
  });

  it("deletes by chunk", () => {
    const p1 = makeEditPattern({ chunkId: "c1" });
    const p2 = makeEditPattern({ id: generateId(), chunkId: "c2" });
    editPatternsRepo.createEditPatterns(db, [p1, p2]);
    const deleted = editPatternsRepo.deleteEditPatternsForChunk(db, "c1");
    expect(deleted).toBe(1);
    expect(editPatternsRepo.listEditPatterns(db, "proj-1")).toHaveLength(1);
  });

  it("handles empty array gracefully", () => {
    const result = editPatternsRepo.createEditPatterns(db, []);
    expect(result).toEqual([]);
  });
});

describe("learned-patterns repository", () => {
  const patternData: PatternData = {
    key: "well",
    phrases: ["well"],
    examples: [{ original: "Well, okay.", edited: "Okay.", context: null }],
  };

  it("creates and lists learned patterns", () => {
    const created = learnedPatternsRepo.createLearnedPattern(db, {
      projectId: "proj-1",
      patternType: "CUT_FILLER",
      patternData,
      occurrences: 6,
      confidence: 0.65,
      status: "proposed",
      proposedAction: { target: "killList", value: "well" },
    });
    expect(created.id).toBeTruthy();
    expect(created.confidence).toBe(0.65);

    const list = learnedPatternsRepo.listLearnedPatterns(db, "proj-1");
    expect(list).toHaveLength(1);
    expect(list[0]!.patternData.key).toBe("well");
    expect(list[0]!.proposedAction!.target).toBe("killList");
  });

  it("filters by status", () => {
    learnedPatternsRepo.createLearnedPattern(db, {
      projectId: "proj-1",
      patternType: "CUT_FILLER",
      patternData,
      occurrences: 6,
      confidence: 0.65,
      status: "proposed",
      proposedAction: null,
    });
    learnedPatternsRepo.createLearnedPattern(db, {
      projectId: "proj-1",
      patternType: "TONE_SHIFT",
      patternData: { ...patternData, key: "other" },
      occurrences: 5,
      confidence: 0.6,
      status: "accepted",
      proposedAction: null,
    });

    expect(learnedPatternsRepo.listLearnedPatterns(db, "proj-1", "proposed")).toHaveLength(1);
    expect(learnedPatternsRepo.listLearnedPatterns(db, "proj-1", "accepted")).toHaveLength(1);
    expect(learnedPatternsRepo.listLearnedPatterns(db, "proj-1")).toHaveLength(2);
  });

  it("updates status", () => {
    const created = learnedPatternsRepo.createLearnedPattern(db, {
      projectId: "proj-1",
      patternType: "CUT_FILLER",
      patternData,
      occurrences: 6,
      confidence: 0.65,
      status: "proposed",
      proposedAction: null,
    });
    const ok = learnedPatternsRepo.updateLearnedPatternStatus(db, created.id, "accepted");
    expect(ok).toBe(true);

    const list = learnedPatternsRepo.listLearnedPatterns(db, "proj-1");
    expect(list[0]!.status).toBe("accepted");
  });

  it("returns false for non-existent pattern update", () => {
    expect(learnedPatternsRepo.updateLearnedPatternStatus(db, "nope", "rejected")).toBe(false);
  });

  it("deletes all patterns for project", () => {
    learnedPatternsRepo.createLearnedPattern(db, {
      projectId: "proj-1",
      patternType: "CUT_FILLER",
      patternData,
      occurrences: 6,
      confidence: 0.65,
      status: "proposed",
      proposedAction: null,
    });
    const deleted = learnedPatternsRepo.deleteLearnedPatternsForProject(db, "proj-1");
    expect(deleted).toBe(1);
    expect(learnedPatternsRepo.listLearnedPatterns(db, "proj-1")).toHaveLength(0);
  });
});
