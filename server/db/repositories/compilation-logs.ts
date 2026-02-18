import type Database from "better-sqlite3";
import type { CompilationLog } from "../../../src/types/index.js";

export function createCompilationLog(db: Database.Database, log: CompilationLog): CompilationLog {
  db.prepare(
    `INSERT INTO compilation_logs (id, chunk_id, data, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(log.id, log.chunkId, JSON.stringify(log), log.timestamp);
  return log;
}

export function getCompilationLog(db: Database.Database, id: string): CompilationLog | null {
  const row = db.prepare("SELECT data FROM compilation_logs WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as CompilationLog;
}

export function listCompilationLogs(db: Database.Database, chunkId: string): CompilationLog[] {
  const rows = db.prepare(
    `SELECT data FROM compilation_logs WHERE chunk_id = ? ORDER BY created_at DESC`,
  ).all(chunkId) as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data) as CompilationLog);
}
