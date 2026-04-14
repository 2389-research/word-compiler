import * as api from "../../api/client.js";
import type { Chunk, NarrativeIR, SceneStatus } from "../../types/index.js";
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

    // Fetch chunks for all scenes in parallel
    const sceneChunks: Record<string, Chunk[]> = {};
    const chunkResults = await Promise.all(
      scenes.map(async (scene) => ({
        sceneId: scene.plan.id,
        chunks: await api.apiListChunks(scene.plan.id),
      })),
    );
    for (const { sceneId, chunks } of chunkResults) {
      sceneChunks[sceneId] = chunks;
    }

    // Fetch narrative IRs for all scenes in the chapter
    const sceneIRs: Record<string, NarrativeIR> = {};
    if (chapterArc) {
      try {
        const irs = await api.apiListChapterIRs(chapterArc.id);
        for (const ir of irs) {
          sceneIRs[ir.sceneId] = ir;
        }
      } catch {
        // No IRs yet — that's fine
      }
    }

    // Fetch voice guide (singleton, may not exist)
    let voiceGuide = null;
    try {
      voiceGuide = await api.apiGetVoiceGuide();
    } catch {
      // No voice guide yet — that's fine
    }

    // Fetch project-level voice guide (may not exist)
    let projectVoiceGuide = null;
    try {
      projectVoiceGuide = await api.apiGetProjectVoiceGuide(projectId);
    } catch {
      // No project voice guide yet — that's fine
    }

    store.loadFromServer({
      project,
      bible,
      chapterArc,
      scenes,
      sceneChunks,
      sceneIRs,
      bibleVersions,
      voiceGuide,
      projectVoiceGuide,
    });

    // Re-distill ring1Injection in background to pick up any CIPHER
    // preferences that accumulated since the last scene completion.
    if (voiceGuide) {
      api
        .apiRedistillVoice(projectId)
        .then(({ ring1Injection, skipped }) => {
          if (!skipped && ring1Injection && store.voiceGuide) {
            store.setVoiceGuide({ ...store.voiceGuide, ring1Injection });
            console.log("[startup] Voice re-distilled with latest CIPHER preferences");
          }
        })
        .catch((err) => console.warn("[startup] Voice re-distill failed:", err));
    }

    return "loaded";
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
    return "error";
  }
}
