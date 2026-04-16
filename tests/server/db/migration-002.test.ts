import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../../server/db/migrations.js";
import { createSchema } from "../../../server/db/schema.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, "../../../server/db/migrations");

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  runMigrations(db, { directory: MIGRATIONS_DIR });
});

afterEach(() => {
  db.close();
});

describe("migration 002 — indexes", () => {
  it("creates idx_scene_plans_project", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_scene_plans_project'")
      .get();
    expect(row).toBeDefined();
  });

  it("creates idx_voice_guide_versions_created_at", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_voice_guide_versions_created_at'")
      .get();
    expect(row).toBeDefined();
  });
});

describe("migration 002 — CHECK triggers: projects.status", () => {
  it("accepts valid project statuses", () => {
    for (const status of ["bootstrap", "bible", "planning", "drafting", "revising"]) {
      const id = `p_${status}`;
      expect(() =>
        db.prepare("INSERT INTO projects (id, title, status) VALUES (?, 'T', ?)").run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid project status on insert", () => {
    expect(() => db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'nonsense')").run()).toThrow(
      /projects\.status/i,
    );
  });

  it("rejects invalid project status on update", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
    expect(() => db.prepare("UPDATE projects SET status = 'nonsense' WHERE id = 'p1'").run()).toThrow(
      /projects\.status/i,
    );
  });
});

describe("migration 002 — CHECK triggers: scene_plans.status", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
  });

  it("accepts valid scene statuses", () => {
    for (const status of ["planned", "drafting", "complete"]) {
      const id = `s_${status}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, 'p1', NULL, 0, ?, '{}')",
          )
          .run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid scene status", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES ('s1', 'p1', NULL, 0, 'bogus', '{}')",
        )
        .run(),
    ).toThrow(/scene_plans\.status/i);
  });
});

describe("migration 002 — CHECK triggers: audit_flags.severity", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES ('s1', 'p1', NULL, 0, 'planned', '{}')",
    ).run();
  });

  it("accepts valid severities", () => {
    for (const severity of ["critical", "warning", "info"]) {
      const id = `f_${severity}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO audit_flags (id, scene_id, severity, category, message, resolved) VALUES (?, 's1', ?, 'voice', 'm', 0)",
          )
          .run(id, severity),
      ).not.toThrow();
    }
  });

  it("rejects invalid severity", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO audit_flags (id, scene_id, severity, category, message, resolved) VALUES ('f1', 's1', 'fatal', 'voice', 'm', 0)",
        )
        .run(),
    ).toThrow(/audit_flags\.severity/i);
  });
});

describe("migration 002 — CHECK triggers: profile_adjustments.status", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
  });

  it("accepts valid statuses", () => {
    for (const status of ["pending", "accepted", "rejected"]) {
      const id = `a_${status}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO profile_adjustments (id, project_id, parameter, current_value, suggested_value, rationale, confidence, evidence, status) VALUES (?, 'p1', 'x', 0, 0, 'r', 0.5, '{}', ?)",
          )
          .run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid status", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO profile_adjustments (id, project_id, parameter, current_value, suggested_value, rationale, confidence, evidence, status) VALUES ('a1', 'p1', 'x', 0, 0, 'r', 0.5, '{}', 'bogus')",
        )
        .run(),
    ).toThrow(/profile_adjustments\.status/i);
  });
});

describe("migration 002 — CHECK triggers: learned_patterns.status", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
  });

  it("accepts valid statuses", () => {
    for (const status of ["proposed", "accepted", "rejected", "expired"]) {
      const id = `l_${status}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO learned_patterns (id, project_id, pattern_type, pattern_data, occurrences, confidence, status, created_at, updated_at) VALUES (?, 'p1', 't', '{}', 1, 0.5, ?, '2026-01-01', '2026-01-01')",
          )
          .run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid status", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO learned_patterns (id, project_id, pattern_type, pattern_data, occurrences, confidence, status, created_at, updated_at) VALUES ('l1', 'p1', 't', '{}', 1, 0.5, 'bogus', '2026-01-01', '2026-01-01')",
        )
        .run(),
    ).toThrow(/learned_patterns\.status/i);
  });
});

// ---------------------------------------------------------------------------
// Regression guard: every value of every TS status/severity union must be
// accepted by the corresponding CHECK trigger. If a union gains a new member
// and this migration is not updated, this suite fails loudly instead of
// silently crashing on first insert in production. The lists below MUST be
// kept in sync with the TS unions in src/types/** and src/learner/**.
// ---------------------------------------------------------------------------

describe("migration 002 — CHECK triggers accept every TS union member", () => {
  const PROJECT_STATUSES = ["bootstrap", "bible", "planning", "drafting", "revising"] as const;
  const SCENE_STATUSES = ["planned", "drafting", "complete"] as const;
  const AUDIT_SEVERITIES = ["critical", "warning", "info"] as const;
  const PROFILE_ADJUSTMENT_STATUSES = ["pending", "accepted", "rejected"] as const;
  const LEARNED_PATTERN_STATUSES = ["proposed", "accepted", "rejected", "expired"] as const;

  it("projects.status: all TS union members", () => {
    for (const status of PROJECT_STATUSES) {
      expect(() =>
        db.prepare("INSERT INTO projects (id, title, status) VALUES (?, 'T', ?)").run(`pu_${status}`, status),
      ).not.toThrow();
    }
  });

  it("scene_plans.status: all TS union members", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('pu', 'T', 'bootstrap')").run();
    for (const status of SCENE_STATUSES) {
      expect(() =>
        db
          .prepare(
            "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, 'pu', NULL, 0, ?, '{}')",
          )
          .run(`su_${status}`, status),
      ).not.toThrow();
    }
  });

  it("audit_flags.severity: all TS union members", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('pu', 'T', 'bootstrap')").run();
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES ('su', 'pu', NULL, 0, 'planned', '{}')",
    ).run();
    for (const severity of AUDIT_SEVERITIES) {
      expect(() =>
        db
          .prepare(
            "INSERT INTO audit_flags (id, scene_id, severity, category, message, resolved) VALUES (?, 'su', ?, 'voice', 'm', 0)",
          )
          .run(`fu_${severity}`, severity),
      ).not.toThrow();
    }
  });

  it("profile_adjustments.status: all TS union members", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('pu', 'T', 'bootstrap')").run();
    for (const status of PROFILE_ADJUSTMENT_STATUSES) {
      expect(() =>
        db
          .prepare(
            "INSERT INTO profile_adjustments (id, project_id, parameter, current_value, suggested_value, rationale, confidence, evidence, status) VALUES (?, 'pu', 'x', 0, 0, 'r', 0.5, '{}', ?)",
          )
          .run(`au_${status}`, status),
      ).not.toThrow();
    }
  });

  it("learned_patterns.status: all TS union members", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('pu', 'T', 'bootstrap')").run();
    for (const status of LEARNED_PATTERN_STATUSES) {
      expect(() =>
        db
          .prepare(
            "INSERT INTO learned_patterns (id, project_id, pattern_type, pattern_data, occurrences, confidence, status, created_at, updated_at) VALUES (?, 'pu', 't', '{}', 1, 0.5, ?, '2026-01-01', '2026-01-01')",
          )
          .run(`lu_${status}`, status),
      ).not.toThrow();
    }
  });
});
