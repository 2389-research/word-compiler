import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProjectVoiceGuide } from "../../../server/db/repositories/project-voice-guide.js";
import {
  getVoiceGuide,
  saveVoiceGuide,
  saveVoiceGuideAndVersion,
} from "../../../server/db/repositories/voice-guide.js";
import { createSchema } from "../../../server/db/schema.js";
import type { VoiceGuide } from "../../../src/profile/types.js";

let db: Database.Database;

function makeGuide(version: string): VoiceGuide {
  return {
    version,
    summary: "summary",
    rules: [],
    antiRules: [],
    examples: [],
    lastUpdated: new Date().toISOString(),
    versionHistory: [
      {
        version,
        updatedAt: new Date().toISOString(),
        changeReason: "test",
        changeSummary: "test change",
        confirmedFeatures: [],
        contradictedFeatures: [],
        newFeatures: [],
      },
    ],
  } as unknown as VoiceGuide;
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("saveVoiceGuide (transactional)", () => {
  it("is atomic: if the INSERT fails, the prior row survives", () => {
    saveVoiceGuide(db, makeGuide("v1"));
    const before = getVoiceGuide(db);
    expect(before?.version).toBe("v1");

    // Force failure by spying on prepare to throw on the INSERT statement.
    const realPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("INSERT INTO voice_guide")) {
        throw new Error("disk full");
      }
      return realPrepare(sql);
    });

    expect(() => saveVoiceGuide(db, makeGuide("v2"))).toThrow(/disk full/);
    spy.mockRestore();

    const after = getVoiceGuide(db);
    expect(after?.version).toBe("v1");
  });
});

describe("saveProjectVoiceGuide (transactional)", () => {
  it("is atomic: if the INSERT fails, the prior row survives", () => {
    saveProjectVoiceGuide(db, "p1", makeGuide("v1"));
    const before = db.prepare("SELECT version FROM project_voice_guide WHERE project_id = 'p1'").get() as {
      version: string;
    };
    expect(before.version).toBe("v1");

    const realPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("INSERT INTO project_voice_guide")) {
        throw new Error("disk full");
      }
      return realPrepare(sql);
    });

    expect(() => saveProjectVoiceGuide(db, "p1", makeGuide("v2"))).toThrow(/disk full/);
    spy.mockRestore();

    const row = db.prepare("SELECT version FROM project_voice_guide WHERE project_id = 'p1'").get() as {
      version: string;
    };
    expect(row.version).toBe("v1");
  });
});

describe("saveVoiceGuideAndVersion", () => {
  it("commits both the voice_guide row and the voice_guide_versions row", () => {
    saveVoiceGuideAndVersion(db, makeGuide("v1"));
    const guideRows = db.prepare("SELECT version FROM voice_guide").all() as Array<{ version: string }>;
    const versionRows = db.prepare("SELECT version FROM voice_guide_versions").all() as Array<{ version: string }>;
    expect(guideRows.map((r) => r.version)).toEqual(["v1"]);
    expect(versionRows.map((r) => r.version)).toEqual(["v1"]);
  });

  it("rolls back both rows if the version insert fails", () => {
    const realPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("INSERT INTO voice_guide_versions")) {
        throw new Error("disk full");
      }
      return realPrepare(sql);
    });

    expect(() => saveVoiceGuideAndVersion(db, makeGuide("v1"))).toThrow(/disk full/);
    spy.mockRestore();

    const guideCount = (db.prepare("SELECT COUNT(*) AS c FROM voice_guide").get() as { c: number }).c;
    const versionCount = (db.prepare("SELECT COUNT(*) AS c FROM voice_guide_versions").get() as { c: number }).c;
    expect(guideCount).toBe(0);
    expect(versionCount).toBe(0);
  });
});
