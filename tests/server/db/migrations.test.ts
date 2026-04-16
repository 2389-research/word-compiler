import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../../server/db/migrations.js";

let db: Database.Database;
let tmpDir: string;

function writeMigration(version: number, body: string, name = "test"): void {
  const padded = String(version).padStart(3, "0");
  fs.writeFileSync(path.join(tmpDir, `${padded}_${name}.sql`), body);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-migrations-"));
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("creates schema_migrations on first run", () => {
    runMigrations(db, { directory: tmpDir });
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
    expect(row).toBeDefined();
  });

  it("applies pending migrations in numeric order", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "create_a");
    writeMigration(2, "CREATE TABLE b (y INTEGER);", "create_b");
    writeMigration(10, "CREATE TABLE c (z INTEGER);", "create_c");

    runMigrations(db, { directory: tmpDir });

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
      name: string;
    }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("c");

    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{
      version: number;
    }>;
    expect(versions.map((v) => v.version)).toEqual([1, 2, 10]);
  });

  it("skips already-applied migrations on second run", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "create_a");
    runMigrations(db, { directory: tmpDir });

    // Second run with the same directory MUST NOT re-run 001 (which would
    // fail with "table a already exists"). Prove it by running twice more.
    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();
    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();

    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{
      version: number;
    }>;
    expect(versions.map((v) => v.version)).toEqual([1]);
  });

  it("applies new migrations added after the initial run", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "create_a");
    runMigrations(db, { directory: tmpDir });

    writeMigration(2, "CREATE TABLE b (y INTEGER);", "create_b");
    runMigrations(db, { directory: tmpDir });

    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{
      version: number;
    }>;
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it("rolls back a failing migration and does not record its version", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "ok");
    writeMigration(2, "THIS IS NOT VALID SQL;", "bad");

    expect(() => runMigrations(db, { directory: tmpDir })).toThrow();

    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{
      version: number;
    }>;
    expect(versions.map((v) => v.version)).toEqual([1]);

    const aExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'a'").get();
    expect(aExists).toBeDefined();
  });

  it("ignores non-matching files in the migrations directory", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "ok");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "docs");
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "notes");

    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();
    const versions = db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1]);
  });

  it("is a no-op when the migrations directory is empty", () => {
    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();
    const count = (db.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get() as { c: number }).c;
    expect(count).toBe(0);
  });
});
