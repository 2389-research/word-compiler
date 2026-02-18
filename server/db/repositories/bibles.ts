import type Database from "better-sqlite3";
import type { Bible } from "../../../src/types/index.js";
import { generateId } from "../../../src/types/index.js";

export function createBible(db: Database.Database, bible: Bible): Bible {
  const id = generateId();
  db.prepare(
    `INSERT INTO bibles (id, project_id, version, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, bible.projectId, bible.version, JSON.stringify(bible), bible.createdAt);
  return bible;
}

export function getLatestBible(db: Database.Database, projectId: string): Bible | null {
  const row = db.prepare(
    `SELECT data FROM bibles WHERE project_id = ? ORDER BY version DESC LIMIT 1`,
  ).get(projectId) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as Bible;
}

export function getBibleVersion(db: Database.Database, projectId: string, version: number): Bible | null {
  const row = db.prepare(
    `SELECT data FROM bibles WHERE project_id = ? AND version = ?`,
  ).get(projectId, version) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as Bible;
}

export function listBibleVersions(db: Database.Database, projectId: string): Array<{ version: number; createdAt: string }> {
  const rows = db.prepare(
    `SELECT version, created_at FROM bibles WHERE project_id = ? ORDER BY version DESC`,
  ).all(projectId) as Array<{ version: number; created_at: string }>;
  return rows.map((r) => ({ version: r.version, createdAt: r.created_at }));
}
