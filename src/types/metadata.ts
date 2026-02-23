import type { CompilationConfig } from "./compilation.js";
import type { ProseMetrics } from "./quality.js";
import type { ReaderState } from "./scene.js";
import { generateId } from "./utils.js";

// ─── Core Project ───────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  status: "bootstrap" | "bible" | "planning" | "drafting" | "revising";
  createdAt: string;
  updatedAt: string;
}

// ─── Chapter Arc ────────────────────────────────────────

export interface ChapterArc {
  id: string;
  projectId: string;
  chapterNumber: number;
  workingTitle: string;
  narrativeFunction: string;
  dominantRegister: string;
  pacingTarget: string;
  endingPosture: string;
  readerStateEntering: ReaderState;
  readerStateExiting: ReaderState;
  sourcePrompt: string | null;
}

// ─── Model Registry ─────────────────────────────────────

export interface ModelSpec {
  id: string;
  label: string;
  contextWindow: number;
  maxOutput: number;
}

export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  // ── Current models ───────────────────────────────────
  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    contextWindow: 200000,
    maxOutput: 128000,
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    contextWindow: 200000,
    maxOutput: 64000,
  },
  "claude-haiku-4-5-20251001": {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    contextWindow: 200000,
    maxOutput: 64000,
  },
  // ── Legacy models ────────────────────────────────────
  "claude-sonnet-4-5-20250929": {
    id: "claude-sonnet-4-5-20250929",
    label: "Claude Sonnet 4.5",
    contextWindow: 200000,
    maxOutput: 64000,
  },
  "claude-opus-4-5-20251101": {
    id: "claude-opus-4-5-20251101",
    label: "Claude Opus 4.5",
    contextWindow: 200000,
    maxOutput: 64000,
  },
  "claude-opus-4-1-20250805": {
    id: "claude-opus-4-1-20250805",
    label: "Claude Opus 4.1",
    contextWindow: 200000,
    maxOutput: 32000,
  },
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    contextWindow: 200000,
    maxOutput: 64000,
  },
  "claude-3-7-sonnet-20250219": {
    id: "claude-3-7-sonnet-20250219",
    label: "Claude Sonnet 3.7",
    contextWindow: 200000,
    maxOutput: 64000,
  },
  "claude-opus-4-20250514": {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    contextWindow: 200000,
    maxOutput: 32000,
  },
  "claude-3-haiku-20240307": {
    id: "claude-3-haiku-20240307",
    label: "Claude Haiku 3",
    contextWindow: 200000,
    maxOutput: 4096,
  },
};

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export function getModelSpec(modelId: string): ModelSpec {
  return (
    MODEL_REGISTRY[modelId] ?? {
      id: modelId,
      label: modelId,
      contextWindow: 200000,
      maxOutput: 64000,
    }
  );
}

export function createDefaultCompilationConfig(modelId: string = DEFAULT_MODEL): CompilationConfig {
  const spec = getModelSpec(modelId);
  return {
    modelContextWindow: spec.contextWindow,
    reservedForOutput: Math.min(2000, spec.maxOutput),
    ring1MaxFraction: 0.15,
    ring2MaxFraction: 0.25,
    ring3MinFraction: 0.6,
    ring1HardCap: 2000,
    bridgeVerbatimTokens: 200,
    bridgeIncludeStateBullets: true,
    maxNegativeExemplarTokens: 80,
    maxNegativeExemplars: 2,
    maxPositiveExemplars: 2,
    defaultTemperature: 0.8,
    defaultTopP: 0.92,
    defaultModel: spec.id,
    sceneTypeOverrides: {},
  };
}

export function createEmptyChapterArc(projectId: string, chapterNumber: number = 1): ChapterArc {
  return {
    id: generateId(),
    projectId,
    chapterNumber,
    workingTitle: "",
    narrativeFunction: "",
    dominantRegister: "",
    pacingTarget: "",
    endingPosture: "",
    readerStateEntering: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    readerStateExiting: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    sourcePrompt: null,
  };
}

// ─── Metrics Reports ────────────────────────────────────

export interface StyleDriftReport {
  baselineSceneId: string;
  currentSceneId: string;
  baselineMetrics: ProseMetrics;
  currentMetrics: ProseMetrics;
  driftPercent: {
    avgSentenceLength: number;
    sentenceLengthVariance: number;
    typeTokenRatio: number;
    avgParagraphLength: number;
  };
  flagged: boolean;
  flaggedFields: string[];
}

export interface VoiceSeparabilityReport {
  characterStats: Array<{
    characterId: string;
    characterName: string;
    dialogueCount: number;
    avgSentenceLength: number;
    sentenceLengthVariance: number;
    typeTokenRatio: number;
  }>;
  interCharacterVariance: number;
  separable: boolean;
  detail: string;
}
