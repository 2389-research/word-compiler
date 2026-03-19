import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import * as auditFlagsRepo from "../../../server/db/repositories/audit-flags.js";
import * as bibles from "../../../server/db/repositories/bibles.js";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as chunks from "../../../server/db/repositories/chunks.js";
import * as compilationLogs from "../../../server/db/repositories/compilation-logs.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { createSchema } from "../../../server/db/schema.js";
import type { CompilationLog } from "../../../src/types/index.js";
import {
  createEmptyBible,
  createEmptyScenePlan,
  generateId,
  makeAuditFlag,
  makeChapterArc,
  makeChunk,
  makeProject,
} from "../../helpers/factories.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
});

// ─── Projects ─────────────────────────────────────────

describe("projects repository", () => {
  it("creates and retrieves a project", () => {
    const p = makeProject();
    projects.createProject(db, p);
    const found = projects.getProject(db, p.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe(p.title);
    expect(found!.status).toBe("bootstrap");
  });

  it("lists projects ordered by updated_at desc", () => {
    const p1 = makeProject({ updatedAt: "2024-01-01T00:00:00Z" });
    const p2 = makeProject({ updatedAt: "2024-06-01T00:00:00Z" });
    projects.createProject(db, p1);
    projects.createProject(db, p2);
    const list = projects.listProjects(db);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(p2.id);
  });

  it("updates a project", () => {
    const p = makeProject();
    projects.createProject(db, p);
    const updated = projects.updateProject(db, p.id, { title: "New Title", status: "drafting" });
    expect(updated!.title).toBe("New Title");
    expect(updated!.status).toBe("drafting");
  });

  it("returns null when updating nonexistent project", () => {
    const result = projects.updateProject(db, "nope", { title: "x" });
    expect(result).toBeNull();
  });

  it("deletes a project", () => {
    const p = makeProject();
    projects.createProject(db, p);
    expect(projects.deleteProject(db, p.id)).toBe(true);
    expect(projects.getProject(db, p.id)).toBeNull();
  });

  it("returns false when deleting nonexistent project", () => {
    expect(projects.deleteProject(db, "nope")).toBe(false);
  });
});

// ─── Bibles ──────────────────────────────────────────

describe("bibles repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("creates and retrieves latest bible", () => {
    const bible = createEmptyBible(projectId);
    bibles.createBible(db, bible);
    const latest = bibles.getLatestBible(db, projectId);
    expect(latest).not.toBeNull();
    expect(latest!.projectId).toBe(projectId);
    expect(latest!.version).toBe(1);
  });

  it("retrieves specific version", () => {
    const v1 = { ...createEmptyBible(projectId), version: 1 };
    const v2 = { ...createEmptyBible(projectId), version: 2 };
    bibles.createBible(db, v1);
    bibles.createBible(db, v2);
    const found = bibles.getBibleVersion(db, projectId, 1);
    expect(found!.version).toBe(1);
  });

  it("latest returns highest version", () => {
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 1 });
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 3 });
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 2 });
    const latest = bibles.getLatestBible(db, projectId);
    expect(latest!.version).toBe(3);
  });

  it("lists all versions", () => {
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 1 });
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 2 });
    const versions = bibles.listBibleVersions(db, projectId);
    expect(versions).toHaveLength(2);
    expect(versions[0]!.version).toBe(2); // desc order
  });

  it("returns null for nonexistent project", () => {
    expect(bibles.getLatestBible(db, "nope")).toBeNull();
  });

  it("upserts when same (projectId, version) is inserted twice", () => {
    const bible1 = { ...createEmptyBible(projectId), version: 1 };
    bibles.createBible(db, bible1);

    // Insert again with same projectId + version but different data
    const bible2 = {
      ...createEmptyBible(projectId),
      version: 1,
      characters: [
        {
          id: "c1",
          name: "Alice",
          role: "protagonist" as const,
          physicalDescription: null,
          backstory: null,
          selfNarrative: null,
          contradictions: null,
          voice: {
            sentenceLengthRange: null,
            vocabularyNotes: null,
            verbalTics: [],
            metaphoricRegister: null,
            prohibitedLanguage: [],
            dialogueSamples: [],
          },
          behavior: null,
        },
      ],
    };
    // Should NOT throw
    expect(() => bibles.createBible(db, bible2)).not.toThrow();

    // Should have updated the existing row, not created a duplicate
    const versions = bibles.listBibleVersions(db, projectId);
    expect(versions).toHaveLength(1);

    const latest = bibles.getLatestBible(db, projectId);
    expect(latest!.characters).toHaveLength(1);
    expect(latest!.characters[0]!.name).toBe("Alice");
  });
});

// ─── Chapter Arcs ────────────────────────────────────

describe("chapter arcs repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("creates and retrieves a chapter arc", () => {
    const arc = makeChapterArc(projectId);
    chapterArcs.createChapterArc(db, arc);
    const found = chapterArcs.getChapterArc(db, arc.id);
    expect(found!.workingTitle).toBe("Chapter One");
  });

  it("retrieves by project and chapter number", () => {
    const arc = makeChapterArc(projectId, { chapterNumber: 5 });
    chapterArcs.createChapterArc(db, arc);
    const found = chapterArcs.getChapterArcByProject(db, projectId, 5);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(arc.id);
  });

  it("updates a chapter arc", () => {
    const arc = makeChapterArc(projectId);
    chapterArcs.createChapterArc(db, arc);
    const updated = chapterArcs.updateChapterArc(db, { ...arc, workingTitle: "Updated" });
    expect(updated.workingTitle).toBe("Updated");
    const found = chapterArcs.getChapterArc(db, arc.id);
    expect(found!.workingTitle).toBe("Updated");
  });

  it("lists chapter arcs ordered by chapter_number", () => {
    chapterArcs.createChapterArc(db, makeChapterArc(projectId, { chapterNumber: 3 }));
    chapterArcs.createChapterArc(db, makeChapterArc(projectId, { chapterNumber: 1 }));
    const list = chapterArcs.listChapterArcs(db, projectId);
    expect(list).toHaveLength(2);
    expect(list[0]!.chapterNumber).toBe(1);
  });

  it("upserts when same (projectId, chapterNumber) is inserted twice", () => {
    const arc1 = makeChapterArc(projectId, { chapterNumber: 1, workingTitle: "Original" });
    chapterArcs.createChapterArc(db, arc1);

    const arc2 = makeChapterArc(projectId, { chapterNumber: 1, workingTitle: "Updated Title" });
    expect(() => chapterArcs.createChapterArc(db, arc2)).not.toThrow();

    const list = chapterArcs.listChapterArcs(db, projectId);
    expect(list).toHaveLength(1);

    const found = chapterArcs.getChapterArcByProject(db, projectId, 1);
    expect(found!.workingTitle).toBe("Updated Title");
  });

  it("upsert returns the persisted row id, not the input id", () => {
    const arc1 = makeChapterArc(projectId, { chapterNumber: 1 });
    const saved1 = chapterArcs.createChapterArc(db, arc1);
    expect(saved1.id).toBe(arc1.id);

    const arc2 = makeChapterArc(projectId, { chapterNumber: 1, workingTitle: "Re-bootstrap" });
    expect(arc2.id).not.toBe(arc1.id); // different client-generated id
    const saved2 = chapterArcs.createChapterArc(db, arc2);
    // Must return the original persisted id so FK references remain valid
    expect(saved2.id).toBe(arc1.id);
    expect(saved2.workingTitle).toBe("Re-bootstrap");
  });
});

// ─── Scene Plans ─────────────────────────────────────

describe("scene plans repository", () => {
  let projectId: string;
  let chapterId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
    const arc = makeChapterArc(projectId);
    chapterArcs.createChapterArc(db, arc);
    chapterId = arc.id;
  });

  it("creates and retrieves a scene plan", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId };
    scenePlans.createScenePlan(db, plan, 0);
    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found).not.toBeNull();
    expect(found!.status).toBe("planned");
    expect(found!.sceneOrder).toBe(0);
  });

  it("lists scene plans for a chapter", () => {
    const p1 = { ...createEmptyScenePlan(projectId), chapterId };
    const p2 = { ...createEmptyScenePlan(projectId), chapterId };
    scenePlans.createScenePlan(db, p1, 1);
    scenePlans.createScenePlan(db, p2, 0);
    const list = scenePlans.listScenePlans(db, chapterId);
    expect(list).toHaveLength(2);
    expect(list[0]!.sceneOrder).toBe(0);
  });

  it("updates scene plan data", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId, title: "Original" };
    scenePlans.createScenePlan(db, plan, 0);
    scenePlans.updateScenePlan(db, { ...plan, title: "Updated" });
    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found!.plan.title).toBe("Updated");
  });

  it("updates scene status", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId };
    scenePlans.createScenePlan(db, plan, 0);
    scenePlans.updateSceneStatus(db, plan.id, "drafting");
    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found!.status).toBe("drafting");
  });

  it("returns false when updating nonexistent scene status", () => {
    expect(scenePlans.updateSceneStatus(db, "nope", "drafting")).toBe(false);
  });

  it("upserts when same scene plan id is inserted twice", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId, title: "Original" };
    scenePlans.createScenePlan(db, plan, 0);

    // Insert same plan again with updated data
    const updated = { ...plan, title: "Reloaded" };
    expect(() => scenePlans.createScenePlan(db, updated, 0)).not.toThrow();

    const list = scenePlans.listScenePlans(db, chapterId);
    expect(list).toHaveLength(1);

    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found!.plan.title).toBe("Reloaded");
  });
});

// ─── Chunks ──────────────────────────────────────────

describe("chunks repository", () => {
  let sceneId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    const arc = makeChapterArc(p.id);
    chapterArcs.createChapterArc(db, arc);
    const plan = { ...createEmptyScenePlan(p.id), chapterId: arc.id };
    scenePlans.createScenePlan(db, plan, 0);
    sceneId = plan.id;
  });

  it("creates and retrieves a chunk", () => {
    const chunk = makeChunk(sceneId, 0);
    chunks.createChunk(db, chunk);
    const found = chunks.getChunk(db, chunk.id);
    expect(found).not.toBeNull();
    expect(found!.generatedText).toBe("Some generated text.");
  });

  it("lists chunks ordered by sequence_number", () => {
    chunks.createChunk(db, makeChunk(sceneId, 2));
    chunks.createChunk(db, makeChunk(sceneId, 0));
    chunks.createChunk(db, makeChunk(sceneId, 1));
    const list = chunks.listChunksForScene(db, sceneId);
    expect(list).toHaveLength(3);
    expect(list[0]!.sequenceNumber).toBe(0);
    expect(list[1]!.sequenceNumber).toBe(1);
    expect(list[2]!.sequenceNumber).toBe(2);
  });

  it("updates chunk data", () => {
    const chunk = makeChunk(sceneId, 0);
    chunks.createChunk(db, chunk);
    chunks.updateChunk(db, { ...chunk, status: "accepted", editedText: "Edited." });
    const found = chunks.getChunk(db, chunk.id);
    expect(found!.status).toBe("accepted");
    expect(found!.editedText).toBe("Edited.");
  });

  it("deletes a chunk", () => {
    const chunk = makeChunk(sceneId, 0);
    chunks.createChunk(db, chunk);
    expect(chunks.deleteChunk(db, chunk.id)).toBe(true);
    expect(chunks.getChunk(db, chunk.id)).toBeNull();
  });

  it("returns false when deleting nonexistent chunk", () => {
    expect(chunks.deleteChunk(db, "nope")).toBe(false);
  });
});

// ─── Audit Flags ─────────────────────────────────────

describe("audit flags repository", () => {
  let sceneId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    const arc = makeChapterArc(p.id);
    chapterArcs.createChapterArc(db, arc);
    const plan = { ...createEmptyScenePlan(p.id), chapterId: arc.id };
    scenePlans.createScenePlan(db, plan, 0);
    sceneId = plan.id;
  });

  it("creates and lists flags ordered by severity", () => {
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId, { severity: "info" }));
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId, { severity: "critical" }));
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId, { severity: "warning" }));
    const list = auditFlagsRepo.listAuditFlags(db, sceneId);
    expect(list).toHaveLength(3);
    expect(list[0]!.severity).toBe("critical");
    expect(list[1]!.severity).toBe("warning");
    expect(list[2]!.severity).toBe("info");
  });

  it("bulk creates flags", () => {
    const flags = [makeAuditFlag(sceneId), makeAuditFlag(sceneId), makeAuditFlag(sceneId)];
    auditFlagsRepo.createAuditFlags(db, flags);
    expect(auditFlagsRepo.listAuditFlags(db, sceneId)).toHaveLength(3);
  });

  it("resolves a flag as actionable", () => {
    const flag = makeAuditFlag(sceneId);
    auditFlagsRepo.createAuditFlag(db, flag);
    const ok = auditFlagsRepo.resolveAuditFlag(db, flag.id, "Fixed the violation", true);
    expect(ok).toBe(true);
    const list = auditFlagsRepo.listAuditFlags(db, sceneId);
    expect(list[0]!.resolved).toBe(true);
    expect(list[0]!.wasActionable).toBe(true);
    expect(list[0]!.resolvedAction).toBe("Fixed the violation");
  });

  it("resolves a flag as non-actionable (dismissed)", () => {
    const flag = makeAuditFlag(sceneId);
    auditFlagsRepo.createAuditFlag(db, flag);
    auditFlagsRepo.resolveAuditFlag(db, flag.id, "False positive", false);
    const list = auditFlagsRepo.listAuditFlags(db, sceneId);
    expect(list[0]!.wasActionable).toBe(false);
  });

  it("returns false when resolving nonexistent flag", () => {
    expect(auditFlagsRepo.resolveAuditFlag(db, "nope", "x", true)).toBe(false);
  });

  it("computes audit stats correctly", () => {
    const f1 = makeAuditFlag(sceneId, { category: "kill_list" });
    const f2 = makeAuditFlag(sceneId, { category: "kill_list" });
    const f3 = makeAuditFlag(sceneId, { category: "rhythm_monotony" });
    auditFlagsRepo.createAuditFlags(db, [f1, f2, f3]);
    auditFlagsRepo.resolveAuditFlag(db, f1.id, "Fixed", true);
    auditFlagsRepo.resolveAuditFlag(db, f2.id, "False positive", false);

    const stats = auditFlagsRepo.getAuditStats(db, sceneId);
    expect(stats.total).toBe(3);
    expect(stats.resolved).toBe(2);
    expect(stats.actionable).toBe(1);
    expect(stats.dismissed).toBe(1);
    expect(stats.signalToNoiseRatio).toBe(0.5);
    expect(stats.pending).toBe(1);
    expect(stats.nonActionable).toBe(1);
    expect(stats.byCategory.kill_list!.total).toBe(2);
    expect(stats.byCategory.kill_list!.actionable).toBe(1);
    expect(stats.byCategory.rhythm_monotony!.total).toBe(1);
  });

  it("signal-to-noise defaults to 1 when no flags resolved", () => {
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId));
    const stats = auditFlagsRepo.getAuditStats(db, sceneId);
    expect(stats.signalToNoiseRatio).toBe(1);
  });
});

// ─── Compilation Logs ────────────────────────────────

describe("compilation logs repository", () => {
  it("creates and retrieves a compilation log", () => {
    const log: CompilationLog = {
      id: generateId(),
      chunkId: "c1",
      payloadHash: "hash",
      ring1Tokens: 100,
      ring2Tokens: 50,
      ring3Tokens: 200,
      totalTokens: 350,
      availableBudget: 198000,
      ring1Contents: ["HEADER", "POV"],
      ring2Contents: [],
      ring3Contents: ["SCENE_CONTRACT"],
      lintWarnings: [],
      lintErrors: [],
      timestamp: new Date().toISOString(),
    };
    compilationLogs.createCompilationLog(db, log);
    const found = compilationLogs.getCompilationLog(db, log.id);
    expect(found).not.toBeNull();
    expect(found!.ring1Tokens).toBe(100);
    expect(found!.ring3Contents).toEqual(["SCENE_CONTRACT"]);
  });

  it("lists logs for a chunk", () => {
    const log1: CompilationLog = {
      id: generateId(),
      chunkId: "c1",
      payloadHash: "h1",
      ring1Tokens: 100,
      ring2Tokens: 0,
      ring3Tokens: 200,
      totalTokens: 300,
      availableBudget: 198000,
      ring1Contents: [],
      ring2Contents: [],
      ring3Contents: [],
      lintWarnings: [],
      lintErrors: [],
      timestamp: "2024-01-01T00:00:00Z",
    };
    const log2: CompilationLog = {
      id: generateId(),
      chunkId: "c1",
      payloadHash: "h2",
      ring1Tokens: 110,
      ring2Tokens: 0,
      ring3Tokens: 210,
      totalTokens: 320,
      availableBudget: 198000,
      ring1Contents: [],
      ring2Contents: [],
      ring3Contents: [],
      lintWarnings: [],
      lintErrors: [],
      timestamp: "2024-02-01T00:00:00Z",
    };
    compilationLogs.createCompilationLog(db, log1);
    compilationLogs.createCompilationLog(db, log2);
    const list = compilationLogs.listCompilationLogs(db, "c1");
    expect(list).toHaveLength(2);
    // Desc order — most recent first
    expect(list[0]!.payloadHash).toBe("h2");
  });
});
