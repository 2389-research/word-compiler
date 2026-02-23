import type Database from "better-sqlite3";
import type { ScenePlan } from "../../../src/types/index.js";

type SceneStatus = "planned" | "drafting" | "complete";

export function createScenePlan(db: Database.Database, plan: ScenePlan, sceneOrder: number): ScenePlan {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       project_id = excluded.project_id,
       chapter_id = excluded.chapter_id,
       scene_order = excluded.scene_order,
       data = excluded.data,
       updated_at = excluded.updated_at`,
  ).run(plan.id, plan.projectId, plan.chapterId ?? null, sceneOrder, "planned", JSON.stringify(plan), now, now);
  return plan;
}

export function getScenePlan(
  db: Database.Database,
  id: string,
): { plan: ScenePlan; status: SceneStatus; sceneOrder: number } | null {
  const row = db.prepare("SELECT data, status, scene_order FROM scene_plans WHERE id = ?").get(id) as
    | { data: string; status: SceneStatus; scene_order: number }
    | undefined;
  if (!row) return null;
  return { plan: JSON.parse(row.data) as ScenePlan, status: row.status, sceneOrder: row.scene_order };
}

export function listScenePlans(
  db: Database.Database,
  chapterId: string,
): Array<{ plan: ScenePlan; status: SceneStatus; sceneOrder: number }> {
  const rows = db
    .prepare(`SELECT data, status, scene_order FROM scene_plans WHERE chapter_id = ? ORDER BY scene_order`)
    .all(chapterId) as Array<{ data: string; status: SceneStatus; scene_order: number }>;
  return rows.map((r) => ({
    plan: JSON.parse(r.data) as ScenePlan,
    status: r.status,
    sceneOrder: r.scene_order,
  }));
}

export function updateScenePlan(db: Database.Database, plan: ScenePlan): ScenePlan {
  const now = new Date().toISOString();
  db.prepare(`UPDATE scene_plans SET data = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(plan), now, plan.id);
  return plan;
}

export function updateSceneStatus(db: Database.Database, id: string, status: SceneStatus): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(`UPDATE scene_plans SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, id);
  return result.changes > 0;
}
