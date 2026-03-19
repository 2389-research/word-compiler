import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import * as preferenceStatements from "../../../server/db/repositories/preference-statements.js";
import * as projectVoiceGuide from "../../../server/db/repositories/project-voice-guide.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as significantEdits from "../../../server/db/repositories/significant-edits.js";
import * as voiceGuide from "../../../server/db/repositories/voice-guide.js";
import * as writingSamples from "../../../server/db/repositories/writing-samples.js";
import { createSchema } from "../../../server/db/schema.js";
import type { PreferenceStatement, SignificantEdit, VoiceGuide } from "../../../src/profile/types.js";
import { createEmptyVoiceGuide, createWritingSample } from "../../../src/profile/types.js";
import { generateId } from "../../../src/types/index.js";
import { makeProject } from "../../helpers/factories.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
});

// ─── Helpers ─────────────────────────────────────────

function makeVoiceGuideWithHistory(): VoiceGuide {
  const guide = createEmptyVoiceGuide();
  guide.version = "1.0.0";
  guide.narrativeSummary = "Test narrative summary";
  guide.corpusSize = 3;
  guide.versionHistory = [
    {
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      changeReason: "Initial creation",
      changeSummary: "Created from 3 samples",
      confirmedFeatures: ["feature-a"],
      contradictedFeatures: [],
      newFeatures: ["feature-b"],
    },
  ];
  return guide;
}

function makeSignificantEdit(projectId: string, overrides: Partial<SignificantEdit> = {}): SignificantEdit {
  return {
    id: generateId(),
    projectId,
    chunkId: generateId(),
    originalText: "The quick brown fox jumped over the lazy dog.",
    editedText: "The brown fox leapt over the lazy dog.",
    processed: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePreferenceStatement(projectId: string, overrides: Partial<PreferenceStatement> = {}): PreferenceStatement {
  return {
    id: generateId(),
    projectId,
    statement: "Avoid filler words like 'just' and 'really'.",
    editCount: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Voice Guide ─────────────────────────────────────

describe("voice guide repository", () => {
  it("returns null when no guide exists", () => {
    expect(voiceGuide.getVoiceGuide(db)).toBeNull();
  });

  it("saves and retrieves a voice guide", () => {
    const guide = makeVoiceGuideWithHistory();
    voiceGuide.saveVoiceGuide(db, guide);
    const found = voiceGuide.getVoiceGuide(db);
    expect(found).not.toBeNull();
    expect(found!.version).toBe("1.0.0");
    expect(found!.narrativeSummary).toBe("Test narrative summary");
    expect(found!.corpusSize).toBe(3);
  });

  it("overwrites existing guide on save (singleton)", () => {
    const guide1 = makeVoiceGuideWithHistory();
    voiceGuide.saveVoiceGuide(db, guide1);

    const guide2 = makeVoiceGuideWithHistory();
    guide2.version = "2.0.0";
    guide2.narrativeSummary = "Updated summary";
    voiceGuide.saveVoiceGuide(db, guide2);

    const found = voiceGuide.getVoiceGuide(db);
    expect(found!.version).toBe("2.0.0");
    expect(found!.narrativeSummary).toBe("Updated summary");
  });

  it("saves a voice guide version to history", () => {
    const guide = makeVoiceGuideWithHistory();
    voiceGuide.saveVoiceGuideVersion(db, guide);
    const versions = voiceGuide.listVoiceGuideVersions(db);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe("1.0.0");
    expect(versions[0]!.changeReason).toBe("Initial creation");
    expect(versions[0]!.changeSummary).toBe("Created from 3 samples");
  });

  it("lists versions in descending created_at order", () => {
    const guide1 = makeVoiceGuideWithHistory();
    guide1.version = "1.0.0";
    guide1.versionHistory = [
      {
        version: "1.0.0",
        updatedAt: "2024-01-01T00:00:00Z",
        changeReason: "First",
        changeSummary: "First version",
        confirmedFeatures: [],
        contradictedFeatures: [],
        newFeatures: [],
      },
    ];
    voiceGuide.saveVoiceGuideVersion(db, guide1);

    const guide2 = makeVoiceGuideWithHistory();
    guide2.version = "1.1.0";
    guide2.versionHistory = [
      {
        version: "1.1.0",
        updatedAt: "2024-06-01T00:00:00Z",
        changeReason: "Second",
        changeSummary: "Second version",
        confirmedFeatures: [],
        contradictedFeatures: [],
        newFeatures: [],
      },
    ];
    voiceGuide.saveVoiceGuideVersion(db, guide2);

    const versions = voiceGuide.listVoiceGuideVersions(db);
    expect(versions).toHaveLength(2);
    expect(versions[0]!.version).toBe("1.1.0");
    expect(versions[1]!.version).toBe("1.0.0");
  });

  it("does not save version when versionHistory is empty", () => {
    const guide = createEmptyVoiceGuide();
    voiceGuide.saveVoiceGuideVersion(db, guide);
    const versions = voiceGuide.listVoiceGuideVersions(db);
    expect(versions).toHaveLength(0);
  });

  it("returns empty array when no versions exist", () => {
    const versions = voiceGuide.listVoiceGuideVersions(db);
    expect(versions).toEqual([]);
  });
});

// ─── Writing Samples ─────────────────────────────────

describe("writing samples repository", () => {
  it("creates and retrieves a writing sample", () => {
    const sample = createWritingSample("essay.txt", "academic", "This is a test essay with several words.");
    writingSamples.createWritingSampleRecord(db, sample);
    const list = writingSamples.listWritingSamples(db);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(sample.id);
    expect(list[0]!.filename).toBe("essay.txt");
    expect(list[0]!.domain).toBe("academic");
    expect(list[0]!.text).toBe("This is a test essay with several words.");
    expect(list[0]!.wordCount).toBe(8);
  });

  it("lists samples ordered by created_at", () => {
    const s1 = createWritingSample("a.txt", "fiction", "First sample text here.");
    s1.createdAt = "2024-01-01T00:00:00Z";
    const s2 = createWritingSample("b.txt", "fiction", "Second sample text here.");
    s2.createdAt = "2024-06-01T00:00:00Z";
    writingSamples.createWritingSampleRecord(db, s1);
    writingSamples.createWritingSampleRecord(db, s2);
    const list = writingSamples.listWritingSamples(db);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(s1.id);
    expect(list[1]!.id).toBe(s2.id);
  });

  it("gets a single sample by id", () => {
    const sample = createWritingSample("test.md", "blog", "Blog post content.");
    writingSamples.createWritingSampleRecord(db, sample);
    const found = writingSamples.getWritingSample(db, sample.id);
    expect(found).not.toBeNull();
    expect(found!.filename).toBe("test.md");
  });

  it("returns null for nonexistent sample", () => {
    expect(writingSamples.getWritingSample(db, "nope")).toBeNull();
  });

  it("gets multiple samples by ids", () => {
    const s1 = createWritingSample("a.txt", "fiction", "Sample A.");
    const s2 = createWritingSample("b.txt", "fiction", "Sample B.");
    const s3 = createWritingSample("c.txt", "fiction", "Sample C.");
    writingSamples.createWritingSampleRecord(db, s1);
    writingSamples.createWritingSampleRecord(db, s2);
    writingSamples.createWritingSampleRecord(db, s3);
    const found = writingSamples.getWritingSamplesByIds(db, [s1.id, s3.id]);
    expect(found).toHaveLength(2);
    const ids = found.map((s) => s.id);
    expect(ids).toContain(s1.id);
    expect(ids).toContain(s3.id);
  });

  it("returns empty array for empty ids list", () => {
    expect(writingSamples.getWritingSamplesByIds(db, [])).toEqual([]);
  });

  it("deletes a writing sample", () => {
    const sample = createWritingSample("delete-me.txt", "test", "Some text.");
    writingSamples.createWritingSampleRecord(db, sample);
    expect(writingSamples.deleteWritingSample(db, sample.id)).toBe(true);
    expect(writingSamples.getWritingSample(db, sample.id)).toBeNull();
  });

  it("returns false when deleting nonexistent sample", () => {
    expect(writingSamples.deleteWritingSample(db, "nope")).toBe(false);
  });

  it("handles null filename", () => {
    const sample = createWritingSample(null, "pasted", "Pasted content.");
    writingSamples.createWritingSampleRecord(db, sample);
    const found = writingSamples.getWritingSample(db, sample.id);
    expect(found!.filename).toBeNull();
  });
});

// ─── Significant Edits ──────────────────────────────

describe("significant edits repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("creates and lists unprocessed edits", () => {
    const edit = makeSignificantEdit(projectId);
    significantEdits.createSignificantEdit(db, edit);
    const list = significantEdits.listUnprocessedEdits(db, projectId);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(edit.id);
    expect(list[0]!.originalText).toBe(edit.originalText);
    expect(list[0]!.editedText).toBe(edit.editedText);
    expect(list[0]!.processed).toBe(false);
  });

  it("lists unprocessed edits ordered by created_at", () => {
    const e1 = makeSignificantEdit(projectId, { createdAt: "2024-01-01T00:00:00Z" });
    const e2 = makeSignificantEdit(projectId, { createdAt: "2024-06-01T00:00:00Z" });
    significantEdits.createSignificantEdit(db, e1);
    significantEdits.createSignificantEdit(db, e2);
    const list = significantEdits.listUnprocessedEdits(db, projectId);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(e1.id);
    expect(list[1]!.id).toBe(e2.id);
  });

  it("does not list processed edits", () => {
    const processed = makeSignificantEdit(projectId, { processed: true });
    const unprocessed = makeSignificantEdit(projectId, { processed: false });
    significantEdits.createSignificantEdit(db, processed);
    significantEdits.createSignificantEdit(db, unprocessed);
    const list = significantEdits.listUnprocessedEdits(db, projectId);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(unprocessed.id);
  });

  it("marks edits as processed", () => {
    const e1 = makeSignificantEdit(projectId);
    const e2 = makeSignificantEdit(projectId);
    const e3 = makeSignificantEdit(projectId);
    significantEdits.createSignificantEdit(db, e1);
    significantEdits.createSignificantEdit(db, e2);
    significantEdits.createSignificantEdit(db, e3);

    significantEdits.markEditsProcessed(db, [e1.id, e3.id]);

    const remaining = significantEdits.listUnprocessedEdits(db, projectId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(e2.id);
  });

  it("handles empty array in markEditsProcessed gracefully", () => {
    const edit = makeSignificantEdit(projectId);
    significantEdits.createSignificantEdit(db, edit);
    significantEdits.markEditsProcessed(db, []);
    const list = significantEdits.listUnprocessedEdits(db, projectId);
    expect(list).toHaveLength(1);
  });

  it("counts unprocessed edits", () => {
    significantEdits.createSignificantEdit(db, makeSignificantEdit(projectId));
    significantEdits.createSignificantEdit(db, makeSignificantEdit(projectId));
    significantEdits.createSignificantEdit(db, makeSignificantEdit(projectId, { processed: true }));
    expect(significantEdits.countUnprocessedEdits(db, projectId)).toBe(2);
  });

  it("returns 0 count when no unprocessed edits", () => {
    expect(significantEdits.countUnprocessedEdits(db, projectId)).toBe(0);
  });

  it("scopes unprocessed edits to project", () => {
    const p2 = makeProject();
    projects.createProject(db, p2);
    significantEdits.createSignificantEdit(db, makeSignificantEdit(projectId));
    significantEdits.createSignificantEdit(db, makeSignificantEdit(p2.id));
    const list = significantEdits.listUnprocessedEdits(db, projectId);
    expect(list).toHaveLength(1);
  });
});

// ─── Preference Statements ──────────────────────────

describe("preference statements repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("creates and lists preference statements", () => {
    const stmt = makePreferenceStatement(projectId);
    preferenceStatements.createPreferenceStatement(db, stmt);
    const list = preferenceStatements.listPreferenceStatements(db, projectId);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(stmt.id);
    expect(list[0]!.statement).toBe(stmt.statement);
    expect(list[0]!.editCount).toBe(5);
  });

  it("lists statements ordered by created_at", () => {
    const s1 = makePreferenceStatement(projectId, { createdAt: "2024-01-01T00:00:00Z" });
    const s2 = makePreferenceStatement(projectId, { createdAt: "2024-06-01T00:00:00Z" });
    preferenceStatements.createPreferenceStatement(db, s1);
    preferenceStatements.createPreferenceStatement(db, s2);
    const list = preferenceStatements.listPreferenceStatements(db, projectId);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(s1.id);
    expect(list[1]!.id).toBe(s2.id);
  });

  it("scopes statements to project", () => {
    const p2 = makeProject();
    projects.createProject(db, p2);
    preferenceStatements.createPreferenceStatement(db, makePreferenceStatement(projectId));
    preferenceStatements.createPreferenceStatement(db, makePreferenceStatement(p2.id));
    const list = preferenceStatements.listPreferenceStatements(db, projectId);
    expect(list).toHaveLength(1);
  });

  it("lists all preference statements across projects", () => {
    const p2 = makeProject();
    projects.createProject(db, p2);
    preferenceStatements.createPreferenceStatement(db, makePreferenceStatement(projectId));
    preferenceStatements.createPreferenceStatement(db, makePreferenceStatement(p2.id));
    const all = preferenceStatements.listAllPreferenceStatements(db);
    expect(all).toHaveLength(2);
  });

  it("returns empty array when no statements exist", () => {
    expect(preferenceStatements.listPreferenceStatements(db, projectId)).toEqual([]);
    expect(preferenceStatements.listAllPreferenceStatements(db)).toEqual([]);
  });

  it("returns the created statement", () => {
    const stmt = makePreferenceStatement(projectId);
    const result = preferenceStatements.createPreferenceStatement(db, stmt);
    expect(result).toEqual(stmt);
  });
});

// ─── Project Voice Guide ────────────────────────────

describe("project voice guide repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("returns null when no project guide exists", () => {
    expect(projectVoiceGuide.getProjectVoiceGuide(db, projectId)).toBeNull();
  });

  it("saves and retrieves a project voice guide", () => {
    const guide = makeVoiceGuideWithHistory();
    projectVoiceGuide.saveProjectVoiceGuide(db, projectId, guide);
    const found = projectVoiceGuide.getProjectVoiceGuide(db, projectId);
    expect(found).not.toBeNull();
    expect(found!.version).toBe("1.0.0");
    expect(found!.narrativeSummary).toBe("Test narrative summary");
  });

  it("overwrites existing project guide on save", () => {
    const guide1 = makeVoiceGuideWithHistory();
    projectVoiceGuide.saveProjectVoiceGuide(db, projectId, guide1);

    const guide2 = makeVoiceGuideWithHistory();
    guide2.version = "2.0.0";
    guide2.narrativeSummary = "Updated project voice";
    projectVoiceGuide.saveProjectVoiceGuide(db, projectId, guide2);

    const found = projectVoiceGuide.getProjectVoiceGuide(db, projectId);
    expect(found!.version).toBe("2.0.0");
    expect(found!.narrativeSummary).toBe("Updated project voice");
  });

  it("scopes guide to project", () => {
    const p2 = makeProject();
    projects.createProject(db, p2);

    const guide1 = makeVoiceGuideWithHistory();
    guide1.narrativeSummary = "Project 1 voice";
    projectVoiceGuide.saveProjectVoiceGuide(db, projectId, guide1);

    const guide2 = makeVoiceGuideWithHistory();
    guide2.narrativeSummary = "Project 2 voice";
    projectVoiceGuide.saveProjectVoiceGuide(db, p2.id, guide2);

    const found1 = projectVoiceGuide.getProjectVoiceGuide(db, projectId);
    expect(found1!.narrativeSummary).toBe("Project 1 voice");

    const found2 = projectVoiceGuide.getProjectVoiceGuide(db, p2.id);
    expect(found2!.narrativeSummary).toBe("Project 2 voice");
  });

  it("deletes a project voice guide", () => {
    const guide = makeVoiceGuideWithHistory();
    projectVoiceGuide.saveProjectVoiceGuide(db, projectId, guide);
    expect(projectVoiceGuide.deleteProjectVoiceGuide(db, projectId)).toBe(true);
    expect(projectVoiceGuide.getProjectVoiceGuide(db, projectId)).toBeNull();
  });

  it("returns false when deleting nonexistent project guide", () => {
    expect(projectVoiceGuide.deleteProjectVoiceGuide(db, "nope")).toBe(false);
  });
});
