import type Database from "better-sqlite3";
import type { Chunk } from "../../../src/types/index.js";

export function createChunk(db: Database.Database, chunk: Chunk): Chunk {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO chunks (id, scene_id, sequence_number, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       scene_id = excluded.scene_id,
       sequence_number = excluded.sequence_number,
       data = excluded.data,
       updated_at = excluded.updated_at`,
  ).run(chunk.id, chunk.sceneId, chunk.sequenceNumber ?? 0, JSON.stringify(chunk), now, now);
  return chunk;
}

export function getChunk(db: Database.Database, id: string): Chunk | null {
  const row = db.prepare("SELECT data FROM chunks WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as Chunk;
}

export function listChunksForScene(db: Database.Database, sceneId: string): Chunk[] {
  const rows = db.prepare(`SELECT data FROM chunks WHERE scene_id = ? ORDER BY sequence_number`).all(sceneId) as Array<{
    data: string;
  }>;
  return rows.map((r) => JSON.parse(r.data) as Chunk);
}

export function updateChunk(db: Database.Database, chunk: Chunk): Chunk {
  const now = new Date().toISOString();
  db.prepare(`UPDATE chunks SET data = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(chunk), now, chunk.id);
  return chunk;
}

export function deleteChunk(db: Database.Database, id: string): boolean {
  const result = db.prepare("DELETE FROM chunks WHERE id = ?").run(id);
  return result.changes > 0;
}
