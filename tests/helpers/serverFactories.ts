import type { PreferenceStatement, SignificantEdit, VoiceGuide, WritingSample } from "../../src/profile/types.js";

export function makeVoiceGuide(overrides: Partial<VoiceGuide> = {}): VoiceGuide {
  return {
    version: "1.0.0",
    versionHistory: [],
    corpusSize: 0,
    domainsRepresented: [],
    coreFeatures: [],
    probableFeatures: [],
    formatVariantFeatures: [],
    domainSpecificFeatures: [],
    avoidancePatterns: [],
    narrativeSummary: "",
    generationInstructions: "",
    editingInstructions: "",
    confidenceNotes: "",
    ring1Injection: "Write in a literary voice.",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeWritingSample(overrides: Partial<WritingSample> = {}): WritingSample {
  return {
    id: `ws-${Math.random().toString(36).slice(2, 10)}`,
    filename: "sample.md",
    domain: "fiction",
    text: "Sample prose body.",
    wordCount: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSignificantEdit(overrides: Partial<SignificantEdit> = {}): SignificantEdit {
  return {
    id: `se-${Math.random().toString(36).slice(2, 10)}`,
    projectId: "proj-test",
    chunkId: "c1",
    originalText: "before",
    editedText: "after",
    processed: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeProjectVoiceGuide(overrides: Partial<VoiceGuide> = {}): VoiceGuide {
  return makeVoiceGuide({ ring1Injection: "Project-scoped voice.", ...overrides });
}

export function makePreferenceStatement(overrides: Partial<PreferenceStatement> = {}): PreferenceStatement {
  return {
    id: `ps-${Math.random().toString(36).slice(2, 10)}`,
    projectId: "proj-test",
    statement: "Prefer concise dialogue tags.",
    editCount: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
