import { computeStyleDriftFromProse } from "../../../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../../../metrics/voiceSeparability.js";
import type { StyleDriftReport, VoiceSeparabilityReport } from "../../../types/index.js";
import { getCanonicalText } from "../../../types/index.js";
import type { ProjectStore } from "../../store/project.svelte.js";

export interface DraftStageMetrics {
  readonly styleDriftReports: StyleDriftReport[];
  readonly voiceReport: VoiceSeparabilityReport | null;
  readonly baselineSceneTitle: string;
  readonly sceneTitles: Record<string, string>;
}

export function createDraftStageMetrics(store: ProjectStore): DraftStageMetrics {
  // Caches preserve the last non-streaming report so we don't churn NLP
  // computations on every streamed token.
  let cachedStyleDrift: StyleDriftReport[] = [];
  let cachedVoiceReport: VoiceSeparabilityReport | null = null;

  const styleDriftReports = $derived.by((): StyleDriftReport[] => {
    if (store.isGenerating) return cachedStyleDrift;
    if (!store.bible) {
      cachedStyleDrift = [];
      return [];
    }
    const completedScenes = store.scenes.filter((s) => s.status === "complete");
    if (completedScenes.length < 2) {
      cachedStyleDrift = [];
      return [];
    }
    const reports: StyleDriftReport[] = [];
    const baselineId = completedScenes[0]!.plan.id;
    const baselineChunks = store.sceneChunks[baselineId] ?? [];
    if (baselineChunks.length === 0) {
      cachedStyleDrift = [];
      return [];
    }
    const baselineProse = baselineChunks.map((c) => getCanonicalText(c)).join("\n\n");
    for (let i = 1; i < completedScenes.length; i++) {
      const scene = completedScenes[i]!;
      const chunks = store.sceneChunks[scene.plan.id] ?? [];
      if (chunks.length === 0) continue;
      const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
      reports.push(computeStyleDriftFromProse(baselineId, baselineProse, scene.plan.id, prose));
    }
    cachedStyleDrift = reports;
    return reports;
  });

  const baselineSceneTitle = $derived(store.scenes.find((s) => s.status === "complete")?.plan.title ?? "Scene 1");

  const sceneTitles = $derived(Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.plan.title])));

  const voiceReport = $derived.by((): VoiceSeparabilityReport | null => {
    if (store.isGenerating) return cachedVoiceReport;
    if (!store.bible || store.bible.characters.length < 2) {
      cachedVoiceReport = null;
      return null;
    }
    const sceneTexts = store.scenes
      .map((s) => ({
        sceneId: s.plan.id,
        prose: (store.sceneChunks[s.plan.id] ?? []).map((c) => getCanonicalText(c)).join("\n\n"),
      }))
      .filter((s) => s.prose.length > 0);
    if (sceneTexts.length === 0) {
      cachedVoiceReport = null;
      return null;
    }
    cachedVoiceReport = measureVoiceSeparability(sceneTexts, store.bible);
    return cachedVoiceReport;
  });

  return {
    get styleDriftReports() {
      return styleDriftReports;
    },
    get voiceReport() {
      return voiceReport;
    },
    get baselineSceneTitle() {
      return baselineSceneTitle;
    },
    get sceneTitles() {
      return sceneTitles;
    },
  };
}
