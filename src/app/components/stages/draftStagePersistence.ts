import type { EditorialAnnotation } from "../../../review/index.js";

function dismissedKey(projectId: string | undefined): string {
  return `review-dismissed:${projectId ?? "default"}`;
}

function annotationsKey(projectId: string | undefined, sceneId: string): string {
  return `review-annotations:${projectId ?? "default"}:${sceneId}`;
}

export function loadDismissed(projectId: string | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedKey(projectId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDismissed(projectId: string | undefined, dismissed: Set<string>): void {
  try {
    localStorage.setItem(dismissedKey(projectId), JSON.stringify([...dismissed]));
  } catch {
    // Ignore storage failures; dismissed state just won't persist.
  }
}

export function loadAnnotations(projectId: string | undefined, sceneId: string): Map<number, EditorialAnnotation[]> {
  try {
    const raw = localStorage.getItem(annotationsKey(projectId, sceneId));
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [number, EditorialAnnotation[]][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function saveAnnotations(
  projectId: string | undefined,
  sceneId: string,
  anns: Map<number, EditorialAnnotation[]>,
): void {
  try {
    localStorage.setItem(annotationsKey(projectId, sceneId), JSON.stringify([...anns]));
  } catch {
    // Ignore storage failures; annotations just won't persist.
  }
}
