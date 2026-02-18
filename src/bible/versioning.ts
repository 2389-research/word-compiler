import type { Bible } from "../types/index.js";

export interface BibleDiff {
  type: "added" | "removed" | "modified";
  area: "character" | "kill_list" | "style_guide" | "narrative_rules" | "location";
  description: string;
}

/**
 * Create a new version of the bible with an incremented version number.
 */
export function createBibleVersion(current: Bible): Bible {
  return {
    ...current,
    version: current.version + 1,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Compute a diff between two bible versions.
 */
export function diffBibles(older: Bible, newer: Bible): BibleDiff[] {
  const diffs: BibleDiff[] = [];

  // --- Characters ---
  const oldCharIds = new Set(older.characters.map((c) => c.id));
  const newCharIds = new Set(newer.characters.map((c) => c.id));

  for (const char of newer.characters) {
    if (!oldCharIds.has(char.id)) {
      diffs.push({ type: "added", area: "character", description: `Character "${char.name}" added` });
    }
  }
  for (const char of older.characters) {
    if (!newCharIds.has(char.id)) {
      diffs.push({ type: "removed", area: "character", description: `Character "${char.name}" removed` });
    }
  }
  for (const newChar of newer.characters) {
    const oldChar = older.characters.find((c) => c.id === newChar.id);
    if (oldChar && JSON.stringify(oldChar) !== JSON.stringify(newChar)) {
      diffs.push({ type: "modified", area: "character", description: `Character "${newChar.name}" modified` });
    }
  }

  // --- Locations ---
  const oldLocIds = new Set(older.locations.map((l) => l.id));
  const newLocIds = new Set(newer.locations.map((l) => l.id));

  for (const loc of newer.locations) {
    if (!oldLocIds.has(loc.id)) {
      diffs.push({ type: "added", area: "location", description: `Location "${loc.name}" added` });
    }
  }
  for (const loc of older.locations) {
    if (!newLocIds.has(loc.id)) {
      diffs.push({ type: "removed", area: "location", description: `Location "${loc.name}" removed` });
    }
  }
  for (const newLoc of newer.locations) {
    const oldLoc = older.locations.find((l) => l.id === newLoc.id);
    if (oldLoc && JSON.stringify(oldLoc) !== JSON.stringify(newLoc)) {
      diffs.push({ type: "modified", area: "location", description: `Location "${newLoc.name}" modified` });
    }
  }

  // --- Kill List ---
  const oldKillPatterns = new Set(older.styleGuide.killList.map((k) => `${k.type}:${k.pattern}`));
  const newKillPatterns = new Set(newer.styleGuide.killList.map((k) => `${k.type}:${k.pattern}`));

  for (const k of newer.styleGuide.killList) {
    if (!oldKillPatterns.has(`${k.type}:${k.pattern}`)) {
      diffs.push({ type: "added", area: "kill_list", description: `Kill list entry "${k.pattern}" added` });
    }
  }
  for (const k of older.styleGuide.killList) {
    if (!newKillPatterns.has(`${k.type}:${k.pattern}`)) {
      diffs.push({ type: "removed", area: "kill_list", description: `Kill list entry "${k.pattern}" removed` });
    }
  }

  // --- Style Guide (coarse-grained) ---
  const oldStyle = { ...older.styleGuide, killList: undefined };
  const newStyle = { ...newer.styleGuide, killList: undefined };
  if (JSON.stringify(oldStyle) !== JSON.stringify(newStyle)) {
    diffs.push({ type: "modified", area: "style_guide", description: "Style guide settings changed" });
  }

  // --- Narrative Rules ---
  if (JSON.stringify(older.narrativeRules) !== JSON.stringify(newer.narrativeRules)) {
    diffs.push({ type: "modified", area: "narrative_rules", description: "Narrative rules changed" });
  }

  return diffs;
}
