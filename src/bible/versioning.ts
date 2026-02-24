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
 * Diff two collections of items by id, producing added/removed/modified diffs.
 */
function diffCollection<T>(
  olderItems: T[],
  newerItems: T[],
  getId: (item: T) => string,
  getLabel: (item: T) => string,
  area: BibleDiff["area"],
): BibleDiff[] {
  const diffs: BibleDiff[] = [];
  const oldIds = new Set(olderItems.map(getId));
  const newIds = new Set(newerItems.map(getId));

  for (const item of newerItems) {
    if (!oldIds.has(getId(item))) {
      diffs.push({ type: "added", area, description: `${getLabel(item)} added` });
    }
  }
  for (const item of olderItems) {
    if (!newIds.has(getId(item))) {
      diffs.push({ type: "removed", area, description: `${getLabel(item)} removed` });
    }
  }
  for (const newItem of newerItems) {
    const oldItem = olderItems.find((o) => getId(o) === getId(newItem));
    if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      diffs.push({ type: "modified", area, description: `${getLabel(newItem)} modified` });
    }
  }
  return diffs;
}

/**
 * Compute a diff between two bible versions.
 */
export function diffBibles(older: Bible, newer: Bible): BibleDiff[] {
  const diffs: BibleDiff[] = [];

  // --- Characters ---
  diffs.push(
    ...diffCollection(
      older.characters,
      newer.characters,
      (c) => c.id,
      (c) => `Character "${c.name}"`,
      "character",
    ),
  );

  // --- Locations ---
  diffs.push(
    ...diffCollection(
      older.locations,
      newer.locations,
      (l) => l.id,
      (l) => `Location "${l.name}"`,
      "location",
    ),
  );

  // --- Kill List ---
  diffs.push(
    ...diffCollection(
      older.styleGuide.killList,
      newer.styleGuide.killList,
      (k) => `${k.type}:${k.pattern}`,
      (k) => `Avoid list entry "${k.pattern}"`,
      "kill_list",
    ),
  );

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
