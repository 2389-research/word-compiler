import { vi } from "vitest";
import type { Commands } from "../../src/app/store/commands.js";
import type { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeChunk, makeSceneEntry } from "../../src/app/stories/factories.js";

export function createMockProjectStore(overrides: Partial<ProjectStore> = {}): ProjectStore {
  const scene = makeSceneEntry("scene-1", "The Confrontation", "drafting");
  const chunk = makeChunk({ sceneId: "scene-1" });
  const base = {
    project: { id: "project-1" },
    bible: { characters: [], voiceRules: [], killList: [] },
    scenes: [scene],
    activeSceneIndex: 0,
    activeScene: scene,
    activeScenePlan: scene.plan,
    activeSceneChunks: [chunk],
    sceneChunks: { "scene-1": [chunk] },
    sceneIRs: {},
    activeSceneIR: null,
    isExtractingIR: false,
    isGenerating: false,
    isAutopilot: false,
    isAuditing: false,
    auditFlags: [],
    compiledPayload: null,
    compilationLog: null,
    lintResult: null,
    metrics: null,
    voiceGuide: null,
    setActiveScene: vi.fn(),
    setSceneAuthoringOpen: vi.fn(),
    setVoiceGuide: vi.fn(),
    cancelGeneration: vi.fn(),
    cancelAutopilot: vi.fn(),
    updateChunkForScene: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as ProjectStore;
}

export function createMockCommands(overrides: Partial<Commands> = {}): Commands {
  const base = {
    saveBible: vi.fn().mockResolvedValue({ ok: true }),
    saveScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    updateScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    saveMultipleScenePlans: vi.fn().mockResolvedValue({ ok: true }),
    saveChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    updateChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    saveChunk: vi.fn().mockResolvedValue({ ok: true }),
    updateChunk: vi.fn().mockResolvedValue({ ok: true }),
    persistChunk: vi.fn().mockResolvedValue({ ok: true }),
    removeChunk: vi.fn().mockResolvedValue({ ok: true }),
    completeScene: vi.fn().mockResolvedValue({ ok: true }),
    saveAuditFlags: vi.fn().mockResolvedValue({ ok: true }),
    resolveAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    dismissAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    saveSceneIR: vi.fn().mockResolvedValue({ ok: true }),
    verifySceneIR: vi.fn().mockResolvedValue({ ok: true }),
    saveCompilationLog: vi.fn().mockResolvedValue({ ok: true }),
    applyRefinement: vi.fn().mockResolvedValue({ ok: true }),
  };
  return { ...base, ...overrides } as unknown as Commands;
}
