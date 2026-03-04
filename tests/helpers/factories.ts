import type { EditPattern } from "../../src/learner/diff.js";
import type { LearnedPattern, PatternData } from "../../src/learner/patterns.js";
import type { TuningProposal } from "../../src/learner/tuning.js";
import {
  type AuditFlag,
  type ChapterArc,
  type Chunk,
  type CompilationLog,
  createEmptyBible,
  createEmptyNarrativeIR,
  createEmptyScenePlan,
  generateId,
  type Project,
  type ReaderState,
} from "../../src/types/index.js";

export { createEmptyBible, createEmptyScenePlan, createEmptyNarrativeIR, generateId };

function makeReaderState(): ReaderState {
  return { knows: [], suspects: [], wrongAbout: [], activeTensions: [] };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: generateId(),
    title: "Test Project",
    status: "bootstrap",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeChapterArc(projectId: string, overrides: Partial<ChapterArc> = {}): ChapterArc {
  return {
    id: generateId(),
    projectId,
    chapterNumber: 1,
    workingTitle: "Chapter One",
    narrativeFunction: "Establish world",
    dominantRegister: "literary",
    pacingTarget: "moderate",
    endingPosture: "question",
    readerStateEntering: makeReaderState(),
    readerStateExiting: makeReaderState(),
    sourcePrompt: null,
    ...overrides,
  };
}

export function makeChunk(sceneId: string, seq: number, overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: generateId(),
    sceneId,
    sequenceNumber: seq,
    generatedText: "Some generated text.",
    payloadHash: "hash",
    model: "test",
    temperature: 0.8,
    topP: 0.92,
    generatedAt: new Date().toISOString(),
    status: "pending",
    editedText: null,
    humanNotes: null,
    ...overrides,
  };
}

export function makeAuditFlag(sceneId: string, overrides: Partial<AuditFlag> = {}): AuditFlag {
  return {
    id: generateId(),
    sceneId,
    severity: "warning",
    category: "kill_list",
    message: "Test violation",
    lineReference: null,
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

export function makeCompilationLog(chunkId: string, overrides: Partial<CompilationLog> = {}): CompilationLog {
  return {
    id: generateId(),
    chunkId,
    payloadHash: `hash-${generateId().slice(0, 6)}`,
    ring1Tokens: 100,
    ring2Tokens: 50,
    ring3Tokens: 200,
    totalTokens: 350,
    availableBudget: 198000,
    ring1Contents: ["HEADER"],
    ring2Contents: [],
    ring3Contents: ["SCENE_CONTRACT"],
    lintWarnings: [],
    lintErrors: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeEditPattern(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: generateId(),
    chunkId: "chunk-1",
    sceneId: "scene-1",
    projectId: "proj-1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "um well",
    editedText: "",
    context: "Before. ... After.",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeLearnedPatternInput(overrides: Partial<Omit<LearnedPattern, "id" | "createdAt">> = {}) {
  const patternData: PatternData = {
    key: "well",
    phrases: ["well"],
    examples: [{ original: "Well, okay.", edited: "Okay.", context: null }],
  };
  return {
    projectId: "proj-1",
    patternType: "CUT_FILLER" as const,
    patternData,
    occurrences: 6,
    confidence: 0.65,
    status: "proposed" as const,
    proposedAction: null,
    ...overrides,
  };
}

export function makeProfileAdjustmentInput(overrides: Partial<Omit<TuningProposal, "id" | "createdAt">> = {}) {
  return {
    projectId: "proj-1",
    parameter: "defaultTemperature",
    currentValue: 0.8,
    suggestedValue: 0.6,
    rationale: "High edit ratio detected",
    confidence: 0.75,
    evidence: { editedChunkCount: 12, sceneCount: 4, avgEditRatio: 0.45 },
    status: "pending" as const,
    ...overrides,
  };
}
