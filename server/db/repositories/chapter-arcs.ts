import type Database from "better-sqlite3";
import type { ChapterArc } from "../../../src/types/index.js";
import { safeJsonParse } from "../helpers.js";

export function createChapterArc(db: Database.Database, arc: ChapterArc): ChapterArc {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO chapter_arcs (id, project_id, chapter_number, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, chapter_number) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at`,
  ).run(arc.id, arc.projectId, arc.chapterNumber, JSON.stringify(arc), now, now);
  // On conflict the row keeps its original id — read it back so the caller
  // (and downstream scene-plan FK references) use the persisted id.
  const row = db
    .prepare("SELECT id FROM chapter_arcs WHERE project_id = ? AND chapter_number = ?")
    .get(arc.projectId, arc.chapterNumber) as { id: string };
  return { ...arc, id: row.id };
}

export function getChapterArc(db: Database.Database, id: string): ChapterArc | null {
  const row = db.prepare("SELECT data FROM chapter_arcs WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  return safeJsonParse<ChapterArc>(row.data, "chapter_arcs.getChapterArc");
}

export function getChapterArcByProject(
  db: Database.Database,
  projectId: string,
  chapterNumber: number,
): ChapterArc | null {
  const row = db
    .prepare(`SELECT data FROM chapter_arcs WHERE project_id = ? AND chapter_number = ?`)
    .get(projectId, chapterNumber) as { data: string } | undefined;
  if (!row) return null;
  return safeJsonParse<ChapterArc>(row.data, "chapter_arcs.getChapterArcByProject");
}

export function updateChapterArc(db: Database.Database, arc: ChapterArc): ChapterArc {
  const now = new Date().toISOString();
  db.prepare(`UPDATE chapter_arcs SET data = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(arc), now, arc.id);
  return arc;
}

export function listChapterArcs(db: Database.Database, projectId: string): ChapterArc[] {
  const rows = db
    .prepare(`SELECT data FROM chapter_arcs WHERE project_id = ? ORDER BY chapter_number`)
    .all(projectId) as Array<{ data: string }>;
  return rows
    .map((r) => safeJsonParse<ChapterArc>(r.data, "chapter_arcs.listChapterArcs"))
    .filter((a): a is ChapterArc => a !== null);
}
