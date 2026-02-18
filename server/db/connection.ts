import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createSchema } from "./schema.js";

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? path.resolve(process.cwd(), "data", "word-compiler.db");
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  return db;
}

export function getMemoryDatabase(): Database.Database {
  const memDb = new Database(":memory:");
  memDb.pragma("foreign_keys = ON");
  createSchema(memDb);
  return memDb;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
