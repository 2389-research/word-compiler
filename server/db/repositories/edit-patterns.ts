import type Database from "better-sqlite3";
import type { EditPattern } from "../../../src/learner/diff.js";

interface EditPatternRow {
  id: string;
  chunk_id: string;
  scene_id: string;
  project_id: string;
  edit_type: string;
  sub_type: string;
  original_text: string;
  edited_text: string;
  context: string | null;
  created_at: string;
}

function rowToPattern(row: EditPatternRow): EditPattern {
  return {
    id: row.id,
    chunkId: row.chunk_id,
    sceneId: row.scene_id,
    projectId: row.project_id,
    editType: row.edit_type as EditPattern["editType"],
    subType: row.sub_type as EditPattern["subType"],
    originalText: row.original_text,
    editedText: row.edited_text,
    context: row.context,
    createdAt: row.created_at,
  };
}

export function createEditPatterns(db: Database.Database, patterns: EditPattern[]): EditPattern[] {
  if (patterns.length === 0) return [];
  const stmt = db.prepare(
    `INSERT INTO edit_patterns (id, chunk_id, scene_id, project_id, edit_type, sub_type, original_text, edited_text, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAll = db.transaction(() => {
    for (const p of patterns) {
      stmt.run(
        p.id,
        p.chunkId,
        p.sceneId,
        p.projectId,
        p.editType,
        p.subType,
        p.originalText,
        p.editedText,
        p.context,
        p.createdAt,
      );
    }
  });
  insertAll();
  return patterns;
}

export function listEditPatterns(db: Database.Database, projectId: string): EditPattern[] {
  const rows = db
    .prepare("SELECT * FROM edit_patterns WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as EditPatternRow[];
  return rows.map(rowToPattern);
}

export function listEditPatternsForScene(db: Database.Database, sceneId: string): EditPattern[] {
  const rows = db
    .prepare("SELECT * FROM edit_patterns WHERE scene_id = ? ORDER BY created_at")
    .all(sceneId) as EditPatternRow[];
  return rows.map(rowToPattern);
}

export function deleteEditPatternsForChunk(db: Database.Database, chunkId: string): number {
  const result = db.prepare("DELETE FROM edit_patterns WHERE chunk_id = ?").run(chunkId);
  return result.changes;
}
