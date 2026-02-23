import type { EditPattern } from "../../learner/diff.js";
import type { TuningProposal } from "../../learner/tuning.js";
import type {
  AuditFlag,
  ChapterArc,
  CharacterDelta,
  Chunk,
  CompilationLog,
  CompiledPayload,
  LintIssue,
  LintResult,
  NarrativeIR,
  Project,
  ProseMetrics,
  ScenePlan,
  StyleDriftReport,
  VoiceSeparabilityReport,
} from "../../types/index.js";
import { createEmptyNarrativeIR, createEmptyScenePlan, generateId } from "../../types/index.js";
import type { SceneEntry } from "../store/project.svelte.js";

// ─── Chunk ─────────────────────────────────────────────

export function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: generateId(),
    sceneId: "scene-1",
    sequenceNumber: 0,
    generatedText:
      "The rain fell in sheets against the window, each drop a tiny percussion in the symphony of the storm. Elena pressed her forehead to the glass, watching the world dissolve into watercolor.",
    editedText: null,
    humanNotes: null,
    status: "pending",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "abc123",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Scene Plan ────────────────────────────────────────

export function makeScenePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("proj-1"),
    title: "The Confrontation",
    povCharacterId: "char-alice",
    narrativeGoal: "Alice discovers the letter and confronts Bob",
    emotionalBeat: "Rising tension → explosive reveal",
    readerEffect: "Reader realizes Bob has been lying",
    pacing: "Slow build to fast climax",
    density: "dense",
    estimatedWordCount: [800, 1200],
    chunkCount: 3,
    chunkDescriptions: [
      "Alice enters the study and finds the letter",
      "She reads the letter and pieces it together",
      "Bob walks in — confrontation erupts",
    ],
    failureModeToAvoid: "Melodramatic dialogue; telegraphing the twist too early",
    ...overrides,
  };
}

// ─── Scene Entry ───────────────────────────────────────

export function makeSceneEntry(
  id: string,
  title: string,
  status: "planned" | "drafting" | "complete",
  overrides: Partial<SceneEntry> = {},
): SceneEntry {
  return {
    plan: makeScenePlan({ id, title }),
    sceneOrder: 0,
    status,
    ...overrides,
  };
}

// ─── Narrative IR ──────────────────────────────────────

export function makeNarrativeIR(overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return {
    ...createEmptyNarrativeIR("scene-1"),
    events: [
      "Alice entered the study",
      "She discovered the letter hidden in the desk drawer",
      "Bob confronted her about reading his correspondence",
    ],
    factsIntroduced: ["The letter was written by Marcus three weeks prior"],
    factsRevealedToReader: ["The letter was written by Marcus", "Alice knew about the affair all along"],
    factsWithheld: ["Marcus is actually Alice's brother"],
    characterDeltas: [
      {
        characterId: "char-alice",
        learned: "Bob has been lying about his alibi",
        suspicionGained: "Marcus may have been involved in the cover-up",
        emotionalShift: "Fear → determination",
        relationshipChange: null,
      },
    ],
    unresolvedTensions: ["Who actually sent the letter?", "What does Marcus know about the incident?"],
    ...overrides,
  };
}

// ─── Audit Flag ────────────────────────────────────────

export function makeAuditFlag(overrides: Partial<AuditFlag> = {}): AuditFlag {
  return {
    id: generateId(),
    sceneId: "scene-1",
    severity: "warning",
    category: "kill-list",
    message: 'Avoid list violation: "suddenly" in paragraph 3',
    lineReference: "P3",
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

// ─── Compiled Payload ──────────────────────────────────

export function makeCompiledPayload(overrides: Partial<CompiledPayload> = {}): CompiledPayload {
  return {
    systemMessage: [
      "You are a literary fiction author writing in close-third POV.",
      "",
      "## VOICE PROFILE",
      "Dense, imagistic prose. Favor concrete sensory detail over abstraction.",
      "Sentence variance: mix short declarative with longer compound-complex.",
      "",
      "## CHARACTERS",
      "Alice Whitmore — protagonist, journalist, guarded but perceptive.",
      "Bob Harlan — supporting, Alice's editor, charming surface conceals anxiety.",
    ].join("\n"),
    userMessage: [
      "## SCENE PLAN",
      "Title: The Confrontation",
      "Goal: Alice discovers Bob's deception through the letter",
      "",
      "## PROSE SO FAR",
      "The rain fell in sheets against the window, each drop a tiny percussion",
      "in the symphony of the storm. Elena pressed her forehead to the glass,",
      "watching the world dissolve into watercolor.",
    ].join("\n"),
    temperature: 0.85,
    topP: 1,
    maxTokens: 4096,
    model: "claude-sonnet-4-6",
    ...overrides,
  };
}

// ─── Compilation Log ───────────────────────────────────

export function makeCompilationLog(overrides: Partial<CompilationLog> = {}): CompilationLog {
  return {
    id: generateId(),
    chunkId: "chunk-1",
    payloadHash: "abc123",
    ring1Tokens: 1200,
    ring2Tokens: 800,
    ring3Tokens: 2400,
    totalTokens: 4400,
    availableBudget: 8000,
    ring1Contents: ["HEADER", "BIBLE_VOICE", "BIBLE_CHARACTERS"],
    ring2Contents: ["CHAPTER_ARC", "PREVIOUS_SCENE_SUMMARY"],
    ring3Contents: ["SCENE_PLAN", "PROSE_SO_FAR", "CONTINUITY_BRIDGE"],
    lintWarnings: [],
    lintErrors: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Lint Result ───────────────────────────────────────

export function makeLintResult(issues: LintIssue[] = []): LintResult {
  return { issues };
}

// ─── Prose Metrics ─────────────────────────────────────

export function makeProseMetrics(overrides: Partial<ProseMetrics> = {}): ProseMetrics {
  return {
    wordCount: 342,
    sentenceCount: 28,
    avgSentenceLength: 12.2,
    sentenceLengthVariance: 4.8,
    typeTokenRatio: 0.68,
    paragraphCount: 6,
    avgParagraphLength: 4.7,
    ...overrides,
  };
}

// ─── Style Drift Report ───────────────────────────────

export function makeStyleDriftReport(
  sceneId: string,
  flagged: boolean,
  drifts: Partial<StyleDriftReport["driftPercent"]> = {},
): StyleDriftReport {
  return {
    baselineSceneId: "scene-1",
    currentSceneId: sceneId,
    baselineMetrics: makeProseMetrics(),
    currentMetrics: makeProseMetrics(),
    driftPercent: {
      avgSentenceLength: 0,
      sentenceLengthVariance: 0,
      typeTokenRatio: 0,
      avgParagraphLength: 0,
      ...drifts,
    },
    flagged,
    flaggedFields: flagged
      ? Object.keys(drifts).filter((k) => Math.abs(drifts[k as keyof typeof drifts] ?? 0) > 0.1)
      : [],
  };
}

// ─── Voice Separability Report ─────────────────────────

export function makeVoiceReport(overrides: Partial<VoiceSeparabilityReport> = {}): VoiceSeparabilityReport {
  return {
    characterStats: [
      {
        characterId: "char-alice",
        characterName: "Alice",
        dialogueCount: 24,
        avgSentenceLength: 8.3,
        sentenceLengthVariance: 3.1,
        typeTokenRatio: 0.72,
      },
      {
        characterId: "char-bob",
        characterName: "Bob",
        dialogueCount: 18,
        avgSentenceLength: 14.6,
        sentenceLengthVariance: 5.8,
        typeTokenRatio: 0.58,
      },
    ],
    interCharacterVariance: 0.42,
    separable: true,
    detail: "Distinct voice signatures: Alice uses short, clipped sentences; Bob favors longer, hedging constructions.",
    ...overrides,
  };
}

// ─── Chapter Arc ───────────────────────────────────────

export function makeChapterArc(overrides: Partial<ChapterArc> = {}): ChapterArc {
  return {
    id: generateId(),
    projectId: "proj-1",
    chapterNumber: 1,
    workingTitle: "The Letter",
    narrativeFunction: "Inciting incident — shatters Alice's false sense of security",
    dominantRegister: "Restrained → explosive",
    pacingTarget: "Slow build in scenes 1-2, rapid acceleration in scene 3",
    endingPosture: "Cliffhanger — Bob's accusation hangs unanswered",
    readerStateEntering: {
      knows: ["Alice is a journalist investigating corruption"],
      suspects: ["Bob may be hiding something"],
      wrongAbout: ["Marcus is a stranger to Alice"],
      activeTensions: ["Will Alice find evidence?"],
    },
    readerStateExiting: {
      knows: ["Alice is a journalist investigating corruption", "Bob lied about his alibi"],
      suspects: ["Marcus is connected to the cover-up"],
      wrongAbout: [],
      activeTensions: ["What will Alice do with the letter?", "Is Bob dangerous?"],
    },
    sourcePrompt: null,
    ...overrides,
  };
}

// ─── Edit Pattern ─────────────────────────────────────

export function makeEditPattern(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: generateId(),
    chunkId: "c1",
    sceneId: "s1",
    projectId: "p1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "well",
    editedText: "",
    context: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tuning Proposal ──────────────────────────────────

export function makeTuningProposal(overrides: Partial<TuningProposal> = {}): TuningProposal {
  return {
    id: generateId(),
    projectId: "p1",
    parameter: "defaultTemperature",
    currentValue: 0.85,
    suggestedValue: 0.65,
    rationale:
      "Average edit ratio is 45% across 12 chunks. Lowering temperature should produce prose closer to your preferred style.",
    confidence: 0.82,
    evidence: { editedChunkCount: 12, sceneCount: 4, avgEditRatio: 0.45 },
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Project ──────────────────────────────────────────

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: generateId(),
    title: "Untitled Project",
    status: "bootstrap",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Character Delta ───────────────────────────────────

export function makeCharacterDelta(overrides: Partial<CharacterDelta> = {}): CharacterDelta {
  return {
    characterId: "char-alice",
    learned: "Bob has been lying about his alibi",
    suspicionGained: "Marcus may have been involved",
    emotionalShift: "Fear → determination",
    relationshipChange: null,
    ...overrides,
  };
}
