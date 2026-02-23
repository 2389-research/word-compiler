// ─── Core Project ───────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  status: "bootstrap" | "bible" | "planning" | "drafting" | "revising";
  createdAt: string;
  updatedAt: string;
}

// ─── Bible ──────────────────────────────────────────────

export interface Bible {
  projectId: string;
  version: number;
  characters: CharacterDossier[];
  styleGuide: StyleGuide;
  narrativeRules: NarrativeRules;
  locations: Location[];
  createdAt: string;
  sourcePrompt: string | null;
}

export interface CharacterDossier {
  id: string;
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  physicalDescription: string | null;
  backstory: string | null;
  selfNarrative: string | null;
  contradictions: string[] | null;
  voice: VoiceFingerprint;
  behavior: CharacterBehavior | null;
}

export interface VoiceFingerprint {
  sentenceLengthRange: [number, number] | null;
  vocabularyNotes: string | null;
  verbalTics: string[];
  metaphoricRegister: string | null;
  prohibitedLanguage: string[];
  dialogueSamples: string[];
}

export interface CharacterBehavior {
  stressResponse: string | null;
  socialPosture: string | null;
  noticesFirst: string | null;
  lyingStyle: string | null;
  emotionPhysicality: string | null;
}

// ─── Style Guide ────────────────────────────────────────

export interface StyleGuide {
  metaphoricRegister: {
    approvedDomains: string[];
    prohibitedDomains: string[];
  } | null;
  vocabularyPreferences: VocabPreference[];
  sentenceArchitecture: {
    targetVariance: string | null;
    fragmentPolicy: string | null;
    notes: string | null;
  } | null;
  paragraphPolicy: {
    maxSentences: number | null;
    singleSentenceFrequency: string | null;
    notes: string | null;
  } | null;
  killList: KillListEntry[];
  negativeExemplars: Exemplar[];
  positiveExemplars: Exemplar[];
  structuralBans: string[];
}

export interface VocabPreference {
  preferred: string;
  insteadOf: string;
  context?: string;
}

export interface KillListEntry {
  pattern: string;
  type: "exact" | "structural";
}

export interface Exemplar {
  text: string;
  annotation: string;
  source?: string;
}

// ─── Narrative Rules ────────────────────────────────────

export interface NarrativeRules {
  pov: {
    default: "first" | "close-third" | "distant-third" | "omniscient";
    distance: "intimate" | "close" | "moderate" | "distant";
    interiority: "stream" | "filtered" | "behavioral-only";
    reliability: "reliable" | "unreliable";
    notes?: string;
  };
  subtextPolicy: string | null;
  expositionPolicy: string | null;
  sceneEndingPolicy: string | null;
  setups: SetupEntry[];
}

export interface SetupEntry {
  id: string;
  description: string;
  plantedInScene: string | null;
  payoffInScene: string | null;
  status: "planned" | "planted" | "paid-off" | "dangling";
}

// ─── Location ───────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  description: string | null;
  sensoryPalette: {
    sounds: string[];
    smells: string[];
    textures: string[];
    lightQuality: string | null;
    atmosphere: string | null;
    prohibitedDefaults: string[];
  };
}

// ─── Scene Plan ─────────────────────────────────────────

export interface ReaderState {
  knows: string[];
  suspects: string[];
  wrongAbout: string[];
  activeTensions: string[];
}

export interface ScenePlan {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  povCharacterId: string;
  povDistance: "intimate" | "close" | "moderate" | "distant";
  narrativeGoal: string;
  emotionalBeat: string;
  readerEffect: string;
  readerStateEntering: ReaderState | null;
  readerStateExiting: ReaderState | null;
  characterKnowledgeChanges: Record<string, string>;
  subtext: {
    surfaceConversation: string;
    actualConversation: string;
    enforcementRule: string;
  } | null;
  dialogueConstraints: Record<string, string[]>;
  pacing: string | null;
  density: "sparse" | "moderate" | "dense";
  sensoryNotes: string | null;
  sceneSpecificProhibitions: string[];
  anchorLines: AnchorLine[];
  estimatedWordCount: [number, number];
  chunkCount: number;
  chunkDescriptions: string[];
  failureModeToAvoid: string;
  locationId: string | null;
}

export interface AnchorLine {
  text: string;
  placement: string;
  verbatim: boolean;
}

// ─── Chunk ──────────────────────────────────────────────

export interface Chunk {
  id: string;
  sceneId: string;
  sequenceNumber: number;
  generatedText: string;
  payloadHash: string;
  model: string;
  temperature: number;
  topP: number;
  generatedAt: string;
  status: "pending" | "accepted" | "edited" | "rejected";
  editedText: string | null;
  humanNotes: string | null;
}

// ─── Compilation ────────────────────────────────────────

export interface CompilationConfig {
  modelContextWindow: number;
  reservedForOutput: number;
  ring1MaxFraction: number;
  ring2MaxFraction: number;
  ring3MinFraction: number;
  ring1HardCap: number;
  bridgeVerbatimTokens: number;
  bridgeIncludeStateBullets: boolean;
  maxNegativeExemplarTokens: number;
  maxNegativeExemplars: number;
  maxPositiveExemplars: number;
  defaultTemperature: number;
  defaultTopP: number;
  defaultModel: string;
  sceneTypeOverrides: Record<string, { temperature: number; topP: number }>;
}

export interface CompiledPayload {
  systemMessage: string;
  userMessage: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  model: string;
  outputSchema?: Record<string, unknown>;
}

export interface CompilationLog {
  id: string;
  chunkId: string;
  payloadHash: string;
  ring1Tokens: number;
  ring2Tokens: number;
  ring3Tokens: number;
  totalTokens: number;
  availableBudget: number;
  ring1Contents: string[];
  ring2Contents: string[];
  ring3Contents: string[];
  lintWarnings: string[];
  lintErrors: string[];
  timestamp: string;
}

// ─── Compiler Internals ─────────────────────────────────

export interface RingSection {
  name: string;
  text: string;
  priority: number;
  immune: boolean;
}

export interface Ring1Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
  wasTruncated: boolean;
}

export interface Ring3Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
}

export interface BudgetResult {
  r1: string;
  r2?: string;
  r3: string;
  r1Sections: RingSection[];
  r2Sections?: RingSection[];
  r3Sections: RingSection[];
  wasCompressed: boolean;
  compressionLog: string[];
}

// ─── Lint ───────────────────────────────────────────────

export interface LintIssue {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
}

// ─── Audit ──────────────────────────────────────────────

export interface AuditFlag {
  id: string;
  sceneId: string;
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  lineReference: string | null;
  resolved: boolean;
  resolvedAction: string | null;
  wasActionable: boolean | null;
}

export interface AuditStats {
  total: number;
  resolved: number;
  dismissed: number;
  pending: number;
  actionable: number;
  nonActionable: number;
  signalToNoiseRatio: number;
  byCategory: Record<string, { total: number; actionable: number }>;
}

export interface ProseMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  typeTokenRatio: number;
  paragraphCount: number;
  avgParagraphLength: number;
}

// ─── Scene Status ───────────────────────────────────────

export type SceneStatus = "planned" | "drafting" | "complete";

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

export interface NarrativeIR {
  sceneId: string;
  verified: boolean;
  events: string[];
  factsIntroduced: string[];
  factsRevealedToReader: string[];
  factsWithheld: string[];
  characterDeltas: CharacterDelta[];
  setupsPlanted: string[];
  payoffsExecuted: string[];
  characterPositions: Record<string, string>;
  unresolvedTensions: string[];
}

export interface CharacterDelta {
  characterId: string;
  learned: string | null;
  suspicionGained: string | null;
  emotionalShift: string | null;
  relationshipChange: string | null;
}

// ─── Metrics ────────────────────────────────────────────

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

// ─── Utility Functions ──────────────────────────────────

export function generateId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for Node <19 — try CJS require, then UUID v4 polyfill for ESM
  try {
    const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
    return randomUUID();
  } catch {
    // ESM context where require is unavailable and globalThis.crypto is missing
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

export function getCanonicalText(chunk: Chunk): string {
  return chunk.editedText ?? chunk.generatedText;
}

export function createEmptyBible(projectId: string): Bible {
  return {
    projectId,
    version: 1,
    characters: [],
    styleGuide: {
      metaphoricRegister: null,
      vocabularyPreferences: [],
      sentenceArchitecture: null,
      paragraphPolicy: null,
      killList: [],
      negativeExemplars: [],
      positiveExemplars: [],
      structuralBans: [],
    },
    narrativeRules: {
      pov: {
        default: "close-third",
        distance: "close",
        interiority: "filtered",
        reliability: "reliable",
      },
      subtextPolicy: null,
      expositionPolicy: null,
      sceneEndingPolicy: null,
      setups: [],
    },
    locations: [],
    createdAt: new Date().toISOString(),
    sourcePrompt: null,
  };
}

export function createEmptyScenePlan(projectId: string): ScenePlan {
  return {
    id: generateId(),
    projectId,
    chapterId: null,
    title: "",
    povCharacterId: "",
    povDistance: "close",
    narrativeGoal: "",
    emotionalBeat: "",
    readerEffect: "",
    readerStateEntering: null,
    readerStateExiting: null,
    characterKnowledgeChanges: {},
    subtext: null,
    dialogueConstraints: {},
    pacing: null,
    density: "moderate",
    sensoryNotes: null,
    sceneSpecificProhibitions: [],
    anchorLines: [],
    estimatedWordCount: [800, 1200],
    chunkCount: 3,
    chunkDescriptions: [],
    failureModeToAvoid: "",
    locationId: null,
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

export function createEmptyNarrativeIR(sceneId: string): NarrativeIR {
  return {
    sceneId,
    verified: false,
    events: [],
    factsIntroduced: [],
    factsRevealedToReader: [],
    factsWithheld: [],
    characterDeltas: [],
    setupsPlanted: [],
    payoffsExecuted: [],
    characterPositions: {},
    unresolvedTensions: [],
  };
}

export function createEmptyCharacterDossier(name: string): CharacterDossier {
  return {
    id: generateId(),
    name,
    role: "supporting",
    physicalDescription: null,
    backstory: null,
    selfNarrative: null,
    contradictions: null,
    voice: {
      sentenceLengthRange: null,
      vocabularyNotes: null,
      verbalTics: [],
      metaphoricRegister: null,
      prohibitedLanguage: [],
      dialogueSamples: [],
    },
    behavior: null,
  };
}
