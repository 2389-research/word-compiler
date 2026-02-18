import type Database from "better-sqlite3";
import type { ChapterArc } from "../../../src/types/index.js";

export function createChapterArc(db: Database.Database, arc: ChapterArc): ChapterArc {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO chapter_arcs (id, project_id, chapter_number, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(arc.id, arc.projectId, arc.chapterNumber, JSON.stringify(arc), now, now);
  return arc;
}

export function getChapterArc(db: Database.Database, id: string): ChapterArc | null {
  const row = db.prepare("SELECT data FROM chapter_arcs WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as ChapterArc;
}

export function getChapterArcByProject(db: Database.Database, projectId: string, chapterNumber: number): ChapterArc | null {
  const row = db.prepare(
    `SELECT data FROM chapter_arcs WHERE project_id = ? AND chapter_number = ?`,
  ).get(projectId, chapterNumber) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as ChapterArc;
}

export function updateChapterArc(db: Database.Database, arc: ChapterArc): ChapterArc {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE chapter_arcs SET data = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(arc), now, arc.id);
  return arc;
}

export function listChapterArcs(db: Database.Database, projectId: string): ChapterArc[] {
  const rows = db.prepare(
    `SELECT data FROM chapter_arcs WHERE project_id = ? ORDER BY chapter_number`,
  ).all(projectId) as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data) as ChapterArc);
}
