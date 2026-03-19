import type Database from "better-sqlite3";
import type { VoiceGuide, VoiceGuideVersion } from "../../../src/profile/types.js";
import { generateId } from "../../../src/types/index.js";

interface VoiceGuideRow {
  id: string;
  version: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface VoiceGuideVersionRow {
  id: string;
  version: string;
  data: string;
  change_reason: string;
  change_summary: string;
  created_at: string;
}

export function getVoiceGuide(db: Database.Database): VoiceGuide | null {
  const row = db.prepare("SELECT * FROM voice_guide LIMIT 1").get() as VoiceGuideRow | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as VoiceGuide;
}

export function saveVoiceGuide(db: Database.Database, guide: VoiceGuide): void {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM voice_guide").run();
  db.prepare(
    `INSERT INTO voice_guide (id, version, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(generateId(), guide.version, JSON.stringify(guide), now, now);
}

export function saveVoiceGuideVersion(db: Database.Database, guide: VoiceGuide): void {
  const latest = guide.versionHistory[guide.versionHistory.length - 1];
  if (!latest) return;
  db.prepare(
    `INSERT INTO voice_guide_versions (id, version, data, change_reason, change_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    generateId(),
    latest.version,
    JSON.stringify(guide),
    latest.changeReason,
    latest.changeSummary,
    latest.updatedAt,
  );
}

export function listVoiceGuideVersions(db: Database.Database): VoiceGuideVersion[] {
  const rows = db
    .prepare("SELECT * FROM voice_guide_versions ORDER BY created_at DESC")
    .all() as VoiceGuideVersionRow[];
  return rows.map((row) => {
    const guide = JSON.parse(row.data) as VoiceGuide;
    const version = guide.versionHistory.find((v) => v.version === row.version);
    if (version) return version;
    return {
      version: row.version,
      updatedAt: row.created_at,
      changeReason: row.change_reason,
      changeSummary: row.change_summary,
      confirmedFeatures: [],
      contradictedFeatures: [],
      newFeatures: [],
    };
  });
}
