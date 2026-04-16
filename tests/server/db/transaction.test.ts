import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { withTransaction } from "../../../server/db/transaction.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)");
});

describe("withTransaction", () => {
  it("commits all writes when the callback returns normally", () => {
    withTransaction(db, () => {
      db.prepare("INSERT INTO t (id, v) VALUES (1, 'a')").run();
      db.prepare("INSERT INTO t (id, v) VALUES (2, 'b')").run();
    });

    const rows = db.prepare("SELECT id, v FROM t ORDER BY id").all() as Array<{ id: number; v: string }>;
    expect(rows).toEqual([
      { id: 1, v: "a" },
      { id: 2, v: "b" },
    ]);
  });

  it("rolls back all writes when the callback throws mid-sequence", () => {
    expect(() =>
      withTransaction(db, () => {
        db.prepare("INSERT INTO t (id, v) VALUES (1, 'a')").run();
        throw new Error("boom");
      }),
    ).toThrow(/boom/);

    const count = (db.prepare("SELECT COUNT(*) AS c FROM t").get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it("returns the callback's return value", () => {
    const result = withTransaction(db, () => {
      db.prepare("INSERT INTO t (id, v) VALUES (42, 'x')").run();
      return "ok";
    });
    expect(result).toBe("ok");
  });

  it("nested withTransaction calls behave atomically via savepoints", () => {
    // better-sqlite3 turns nested transactions into savepoints automatically.
    // Inner throw must roll back only inner writes if the outer catches it.
    withTransaction(db, () => {
      db.prepare("INSERT INTO t (id, v) VALUES (1, 'outer')").run();
      try {
        withTransaction(db, () => {
          db.prepare("INSERT INTO t (id, v) VALUES (2, 'inner')").run();
          throw new Error("inner boom");
        });
      } catch {
        // swallow — outer should survive
      }
    });

    const rows = db.prepare("SELECT id FROM t ORDER BY id").all() as Array<{ id: number }>;
    expect(rows.map((r) => r.id)).toEqual([1]);
  });
});
