import type Database from "better-sqlite3";
import type { SignificantEdit } from "../../../src/profile/types.js";

interface SignificantEditRow {
  id: string;
  project_id: string;
  chunk_id: string;
  original_text: string;
  edited_text: string;
  processed: number;
  created_at: string;
}

function rowToEdit(row: SignificantEditRow): SignificantEdit {
  return {
    id: row.id,
    projectId: row.project_id,
    chunkId: row.chunk_id,
    originalText: row.original_text,
    editedText: row.edited_text,
    processed: row.processed === 1,
    createdAt: row.created_at,
  };
}

export function createSignificantEdit(db: Database.Database, edit: SignificantEdit): void {
  db.prepare(
    `INSERT INTO significant_edits (id, project_id, chunk_id, original_text, edited_text, processed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    edit.id,
    edit.projectId,
    edit.chunkId,
    edit.originalText,
    edit.editedText,
    edit.processed ? 1 : 0,
    edit.createdAt,
  );
}

export function listUnprocessedEdits(db: Database.Database, projectId: string): SignificantEdit[] {
  const rows = db
    .prepare("SELECT * FROM significant_edits WHERE project_id = ? AND processed = 0 ORDER BY created_at")
    .all(projectId) as SignificantEditRow[];
  return rows.map(rowToEdit);
}

export function countUnprocessedEdits(db: Database.Database, projectId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM significant_edits WHERE project_id = ? AND processed = 0")
    .get(projectId) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function markEditsProcessed(db: Database.Database, editIds: string[]): void {
  if (editIds.length === 0) return;
  const placeholders = editIds.map(() => "?").join(", ");
  db.prepare(`UPDATE significant_edits SET processed = 1 WHERE id IN (${placeholders})`).run(...editIds);
}
