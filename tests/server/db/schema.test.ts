import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { createSchema } from "../../../server/db/schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
});

describe("createSchema", () => {
  it("creates all expected tables", () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);

    expect(names).toContain("projects");
    expect(names).toContain("bibles");
    expect(names).toContain("chapter_arcs");
    expect(names).toContain("scene_plans");
    expect(names).toContain("chunks");
    expect(names).toContain("compilation_logs");
    expect(names).toContain("audit_flags");
    expect(names).toContain("compiled_payloads");
  });

  it("is idempotent (can run twice)", () => {
    expect(() => createSchema(db)).not.toThrow();
  });

  it("enforces foreign keys on projects", () => {
    expect(() => {
      db.prepare(
        "INSERT INTO bibles (id, project_id, version, data) VALUES ('b1', 'nonexistent', 1, '{}')",
      ).run();
    }).toThrow();
  });

  it("enforces unique (project_id, version) on bibles", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'Test', 'bootstrap')").run();
    db.prepare("INSERT INTO bibles (id, project_id, version, data) VALUES ('b1', 'p1', 1, '{}')").run();
    expect(() => {
      db.prepare("INSERT INTO bibles (id, project_id, version, data) VALUES ('b2', 'p1', 1, '{}')").run();
    }).toThrow();
  });

  it("enforces unique (project_id, chapter_number) on chapter_arcs", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'Test', 'bootstrap')").run();
    db.prepare("INSERT INTO chapter_arcs (id, project_id, chapter_number, data) VALUES ('c1', 'p1', 1, '{}')").run();
    expect(() => {
      db.prepare("INSERT INTO chapter_arcs (id, project_id, chapter_number, data) VALUES ('c2', 'p1', 1, '{}')").run();
    }).toThrow();
  });

  it("creates expected indexes", () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name",
    ).all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);

    expect(names).toContain("idx_bibles_project");
    expect(names).toContain("idx_chapter_arcs_project");
    expect(names).toContain("idx_scene_plans_chapter");
    expect(names).toContain("idx_chunks_scene");
    expect(names).toContain("idx_compilation_logs_chunk");
    expect(names).toContain("idx_audit_flags_scene");
    expect(names).toContain("idx_compiled_payloads_chunk");
  });
});
