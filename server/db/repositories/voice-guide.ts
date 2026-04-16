import type Database from "better-sqlite3";
import type { VoiceGuide, VoiceGuideVersion } from "../../../src/profile/types.js";
import { generateId } from "../../../src/types/index.js";
import { safeJsonParse } from "../helpers.js";
import { withTransaction } from "../transaction.js";

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
  return safeJsonParse<VoiceGuide>(row.data, "voice_guide.getVoiceGuide");
}

export function saveVoiceGuide(db: Database.Database, guide: VoiceGuide): void {
  const now = new Date().toISOString();
  withTransaction(db, () => {
    db.prepare("DELETE FROM voice_guide").run();
    db.prepare(
      `INSERT INTO voice_guide (id, version, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(generateId(), guide.version, JSON.stringify(guide), now, now);
  });
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
    const guide = safeJsonParse<VoiceGuide>(row.data, "voice_guide.listVoiceGuideVersions");
    const versionHistory = Array.isArray(guide?.versionHistory) ? guide.versionHistory : [];
    const version = versionHistory.find((v) => v.version === row.version);
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

/**
 * Atomically saves the current voice guide AND appends a version history row.
 * Used by the CIPHER batch flow so a partial write cannot leave the guide
 * and its version history out of sync. Callers that need only one of the
 * two operations should continue to use saveVoiceGuide / saveVoiceGuideVersion
 * directly.
 */
export function saveVoiceGuideAndVersion(db: Database.Database, guide: VoiceGuide): void {
  withTransaction(db, () => {
    saveVoiceGuide(db, guide);
    saveVoiceGuideVersion(db, guide);
  });
}
