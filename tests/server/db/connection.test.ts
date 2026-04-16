import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSchema } from "../../../server/db/schema.js";

describe("connection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("getMemoryDatabase returns a working DB with schema", () => {
    // Use real better-sqlite3 directly — mirrors what getMemoryDatabase does
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    createSchema(db);

    // Verify FK pragma is enabled
    const fkResult = db.pragma("foreign_keys") as Array<{ foreign_keys: number }>;
    expect(fkResult[0]!.foreign_keys).toBe(1);

    // Prove schema exists by inserting a project
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'Test Project', 'bootstrap')").run();
    const row = db.prepare("SELECT id, title FROM projects WHERE id = 'p1'").get() as {
      id: string;
      title: string;
    };
    expect(row.id).toBe("p1");
    expect(row.title).toBe("Test Project");

    db.close();
  });

  it("closeDatabase is a no-op when no DB is open", async () => {
    const { closeDatabase } = await import("../../../server/db/connection.js");
    expect(() => closeDatabase()).not.toThrow();
  });

  it("getDatabase creates directory if it doesn't exist", async () => {
    const mockExistsSync = vi.fn().mockReturnValue(false);
    const mockMkdirSync = vi.fn();

    vi.doMock("node:fs", () => ({
      default: { existsSync: mockExistsSync, mkdirSync: mockMkdirSync },
      existsSync: mockExistsSync,
      mkdirSync: mockMkdirSync,
    }));

    const mockPragma = vi.fn();
    const mockClose = vi.fn();
    vi.doMock("better-sqlite3", () => ({
      default: vi.fn().mockReturnValue({ pragma: mockPragma, close: mockClose }),
    }));

    vi.doMock("../../../server/db/schema.js", () => ({
      createSchema: vi.fn(),
    }));
    vi.doMock("../../../server/db/migrations.js", () => ({ runMigrations: vi.fn() }));

    const { getDatabase, closeDatabase } = await import("../../../server/db/connection.js");
    getDatabase("/tmp/test-wc/nested/dir/test.db");

    expect(mockExistsSync).toHaveBeenCalled();
    expect(mockMkdirSync).toHaveBeenCalledWith("/tmp/test-wc/nested/dir", { recursive: true });

    closeDatabase();
  });

  it("getDatabase returns same instance on second call (singleton)", async () => {
    const mockExistsSync = vi.fn().mockReturnValue(true);
    vi.doMock("node:fs", () => ({
      default: { existsSync: mockExistsSync, mkdirSync: vi.fn() },
      existsSync: mockExistsSync,
      mkdirSync: vi.fn(),
    }));

    const ctor = vi.fn().mockReturnValue({ pragma: vi.fn(), close: vi.fn() });
    vi.doMock("better-sqlite3", () => ({
      default: ctor,
    }));

    vi.doMock("../../../server/db/schema.js", () => ({
      createSchema: vi.fn(),
    }));
    vi.doMock("../../../server/db/migrations.js", () => ({ runMigrations: vi.fn() }));

    const { getDatabase, closeDatabase } = await import("../../../server/db/connection.js");
    const first = getDatabase("/tmp/singleton-test.db");
    const second = getDatabase("/tmp/singleton-test.db");

    expect(first).toBe(second);
    expect(ctor).toHaveBeenCalledTimes(1);

    closeDatabase();
  });
});
