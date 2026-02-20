import * as api from "../../api/client.js";
import type { Chunk, SceneStatus } from "../../types/index.js";
import type { ProjectStore, SceneEntry } from "./project.svelte.js";

export type StartupResult = "loaded" | "no-projects" | "multiple-projects" | "error";

export async function initializeApp(store: ProjectStore): Promise<StartupResult> {
  try {
    const projects = await api.apiListProjects();

    if (projects.length === 0) return "no-projects";
    if (projects.length > 1) return "multiple-projects";

    return loadProject(store, projects[0]!.id);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
    return "error";
  }
}

export async function loadProject(store: ProjectStore, projectId: string): Promise<StartupResult> {
  try {
    const project = await api.apiGetProject(projectId);

    // Fetch bible (may not exist yet)
    let bible = null;
    try {
      bible = await api.apiGetLatestBible(projectId);
    } catch {
      // No bible yet — that's fine
    }

    const bibleVersions = await api.apiListBibleVersions(projectId);
    const chapters = await api.apiListChapterArcs(projectId);
    const chapterArc = chapters.length > 0 ? chapters[0]! : null;

    // Fetch scenes for the chapter (if one exists)
    let scenes: SceneEntry[] = [];
    if (chapterArc) {
      const sceneRows = await api.apiListScenePlans(chapterArc.id);
      scenes = sceneRows.map((row) => ({
        plan: row.plan,
        status: row.status as SceneStatus,
        sceneOrder: row.sceneOrder,
      }));
    }

    // Fetch chunks for each scene
    const sceneChunks: Record<string, Chunk[]> = {};
    for (const scene of scenes) {
      sceneChunks[scene.plan.id] = await api.apiListChunks(scene.plan.id);
    }

    store.loadFromServer({
      project,
      bible,
      chapterArc,
      scenes,
      sceneChunks,
      bibleVersions,
    });

    return "loaded";
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
    return "error";
  }
}
