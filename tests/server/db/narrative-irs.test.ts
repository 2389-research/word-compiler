import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import * as narrativeIRs from "../../../server/db/repositories/narrative-irs.js";
import { createSchema } from "../../../server/db/schema.js";
import { createEmptyNarrativeIR, generateId } from "../../../src/types/index.js";

let db: Database.Database;

function seedSceneAndProject(db: Database.Database): { projectId: string; chapterId: string; sceneId: string } {
  const projectId = generateId();
  const chapterId = generateId();
  const sceneId = generateId();

  db.prepare("INSERT INTO projects (id, title, status) VALUES (?, 'Test', 'bootstrap')").run(projectId);
  db.prepare("INSERT INTO chapter_arcs (id, project_id, chapter_number, data) VALUES (?, ?, 1, '{}')").run(
    chapterId,
    projectId,
  );
  db.prepare(
    "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, ?, ?, 0, 'planned', '{}')",
  ).run(sceneId, projectId, chapterId);

  return { projectId, chapterId, sceneId };
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
});

describe("narrative IRs repository", () => {
  it("creates and retrieves an IR", () => {
    const { sceneId } = seedSceneAndProject(db);
    const ir = createEmptyNarrativeIR(sceneId);
    ir.events = ["The door opened"];
    ir.factsIntroduced = ["The house is occupied"];

    narrativeIRs.createNarrativeIR(db, ir);
    const retrieved = narrativeIRs.getNarrativeIR(db, sceneId);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.sceneId).toBe(sceneId);
    expect(retrieved!.events).toEqual(["The door opened"]);
    expect(retrieved!.factsIntroduced).toEqual(["The house is occupied"]);
    expect(retrieved!.verified).toBe(false);
  });

  it("returns null for non-existent scene", () => {
    const result = narrativeIRs.getNarrativeIR(db, "nonexistent");
    expect(result).toBeNull();
  });

  it("updates an existing IR", () => {
    const { sceneId } = seedSceneAndProject(db);
    const ir = createEmptyNarrativeIR(sceneId);
    narrativeIRs.createNarrativeIR(db, ir);

    const updated = { ...ir, events: ["Updated event"], unresolvedTensions: ["New tension"] };
    narrativeIRs.updateNarrativeIR(db, updated);

    const retrieved = narrativeIRs.getNarrativeIR(db, sceneId);
    expect(retrieved!.events).toEqual(["Updated event"]);
    expect(retrieved!.unresolvedTensions).toEqual(["New tension"]);
  });

  it("verifies an IR", () => {
    const { sceneId } = seedSceneAndProject(db);
    narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(sceneId));

    const ok = narrativeIRs.verifyNarrativeIR(db, sceneId);
    expect(ok).toBe(true);

    const retrieved = narrativeIRs.getNarrativeIR(db, sceneId);
    expect(retrieved!.verified).toBe(true);
  });

  it("returns false when verifying non-existent IR", () => {
    const ok = narrativeIRs.verifyNarrativeIR(db, "nonexistent");
    expect(ok).toBe(false);
  });

  it("lists all IRs for a chapter in scene order", () => {
    const projectId = generateId();
    const chapterId = generateId();
    const sceneId1 = generateId();
    const sceneId2 = generateId();

    db.prepare("INSERT INTO projects (id, title, status) VALUES (?, 'Test', 'bootstrap')").run(projectId);
    db.prepare("INSERT INTO chapter_arcs (id, project_id, chapter_number, data) VALUES (?, ?, 1, '{}')").run(
      chapterId,
      projectId,
    );
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, ?, ?, 0, 'planned', '{}')",
    ).run(sceneId1, projectId, chapterId);
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, ?, ?, 1, 'planned', '{}')",
    ).run(sceneId2, projectId, chapterId);

    const ir1 = { ...createEmptyNarrativeIR(sceneId1), events: ["Scene 1 event"] };
    const ir2 = { ...createEmptyNarrativeIR(sceneId2), events: ["Scene 2 event"] };
    narrativeIRs.createNarrativeIR(db, ir1);
    narrativeIRs.createNarrativeIR(db, ir2);

    const all = narrativeIRs.listAllIRsForChapter(db, chapterId);
    expect(all).toHaveLength(2);
    expect(all[0]!.events[0]).toBe("Scene 1 event");
    expect(all[1]!.events[0]).toBe("Scene 2 event");
  });

  it("listVerifiedIRsForChapter returns only verified IRs", () => {
    const projectId = generateId();
    const chapterId = generateId();
    const sceneId1 = generateId();
    const sceneId2 = generateId();

    db.prepare("INSERT INTO projects (id, title, status) VALUES (?, 'Test', 'bootstrap')").run(projectId);
    db.prepare("INSERT INTO chapter_arcs (id, project_id, chapter_number, data) VALUES (?, ?, 1, '{}')").run(
      chapterId,
      projectId,
    );
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, ?, ?, 0, 'planned', '{}')",
    ).run(sceneId1, projectId, chapterId);
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, ?, ?, 1, 'planned', '{}')",
    ).run(sceneId2, projectId, chapterId);

    narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(sceneId1));
    narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(sceneId2));
    narrativeIRs.verifyNarrativeIR(db, sceneId1); // Only verify first

    const verified = narrativeIRs.listVerifiedIRsForChapter(db, chapterId);
    expect(verified).toHaveLength(1);
    expect(verified[0]!.sceneId).toBe(sceneId1);
    expect(verified[0]!.verified).toBe(true);
  });

  it("enforces unique scene_id constraint", () => {
    const { sceneId } = seedSceneAndProject(db);
    narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(sceneId));
    expect(() => narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(sceneId))).toThrow();
  });

  it("preserves characterDeltas and nested fields", () => {
    const { sceneId } = seedSceneAndProject(db);
    const ir = {
      ...createEmptyNarrativeIR(sceneId),
      characterDeltas: [
        {
          characterId: "c1",
          learned: "the truth",
          suspicionGained: null,
          emotionalShift: "shock",
          relationshipChange: null,
        },
      ],
      characterPositions: { Alice: "doorway" },
    };
    narrativeIRs.createNarrativeIR(db, ir);
    const retrieved = narrativeIRs.getNarrativeIR(db, sceneId);
    expect(retrieved!.characterDeltas[0]!.learned).toBe("the truth");
    expect(retrieved!.characterPositions["Alice"]).toBe("doorway");
  });
});
