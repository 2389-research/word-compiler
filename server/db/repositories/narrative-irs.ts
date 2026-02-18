import type Database from "better-sqlite3";
import type { NarrativeIR } from "../../../src/types/index.js";
import { generateId } from "../../../src/types/index.js";

interface NarrativeIRRow {
  id: string;
  scene_id: string;
  verified: number;
  data: string;
  created_at: string;
  verified_at: string | null;
}

function rowToIR(row: NarrativeIRRow): NarrativeIR {
  const data = JSON.parse(row.data) as Omit<NarrativeIR, "sceneId" | "verified">;
  return {
    ...data,
    sceneId: row.scene_id,
    verified: row.verified === 1,
  };
}

export function createNarrativeIR(db: Database.Database, ir: NarrativeIR): NarrativeIR {
  const id = generateId();
  const now = new Date().toISOString();
  const { sceneId, verified, ...rest } = ir;
  db.prepare(
    `INSERT INTO narrative_irs (id, scene_id, verified, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, sceneId, verified ? 1 : 0, JSON.stringify(rest), now);
  return ir;
}

export function getNarrativeIR(db: Database.Database, sceneId: string): NarrativeIR | null {
  const row = db.prepare("SELECT * FROM narrative_irs WHERE scene_id = ?").get(sceneId) as NarrativeIRRow | undefined;
  if (!row) return null;
  return rowToIR(row);
}

export function updateNarrativeIR(db: Database.Database, ir: NarrativeIR): NarrativeIR {
  const { sceneId, verified, ...rest } = ir;
  db.prepare(`UPDATE narrative_irs SET verified = ?, data = ? WHERE scene_id = ?`).run(
    verified ? 1 : 0,
    JSON.stringify(rest),
    sceneId,
  );
  return ir;
}

export function verifyNarrativeIR(db: Database.Database, sceneId: string): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE narrative_irs SET verified = 1, verified_at = ? WHERE scene_id = ?")
    .run(now, sceneId);
  return result.changes > 0;
}

export function listVerifiedIRsForChapter(db: Database.Database, chapterId: string): NarrativeIR[] {
  const rows = db
    .prepare(
      `SELECT ni.* FROM narrative_irs ni
       JOIN scene_plans sp ON sp.id = ni.scene_id
       WHERE sp.chapter_id = ? AND ni.verified = 1
       ORDER BY sp.scene_order`,
    )
    .all(chapterId) as NarrativeIRRow[];
  return rows.map(rowToIR);
}

export function listAllIRsForChapter(db: Database.Database, chapterId: string): NarrativeIR[] {
  const rows = db
    .prepare(
      `SELECT ni.* FROM narrative_irs ni
       JOIN scene_plans sp ON sp.id = ni.scene_id
       WHERE sp.chapter_id = ?
       ORDER BY sp.scene_order`,
    )
    .all(chapterId) as NarrativeIRRow[];
  return rows.map(rowToIR);
}
