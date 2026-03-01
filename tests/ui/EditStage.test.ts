import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import EditStage from "../../src/app/components/stages/EditStage.svelte";
import { makeChunk, makeSceneEntry } from "../../src/app/stories/factories.js";

vi.mock("@tiptap/core", () => ({
  Editor: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    getText: vi.fn().mockReturnValue(""),
    state: { doc: { descendants: vi.fn() }, selection: { from: 0, to: 0 } },
    commands: { setContent: vi.fn() },
    setEditable: vi.fn(),
    view: { coordsAtPos: vi.fn().mockReturnValue({ top: 0, bottom: 0, left: 0 }) },
    registerPlugin: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock("@tiptap/extension-document", () => ({ default: {} }));
vi.mock("@tiptap/extension-paragraph", () => ({ default: {} }));
vi.mock("@tiptap/extension-text", () => ({ default: {} }));

function createMockStore(overrides = {}) {
  const scene = makeSceneEntry("scene-1", "The Confrontation", "drafting");
  const chunk = makeChunk({ sceneId: "scene-1" });
  return {
    scenes: [scene],
    activeSceneIndex: 0,
    activeScenePlan: scene.plan,
    activeSceneChunks: [chunk],
    sceneChunks: { "scene-1": [chunk] },
    setActiveScene: vi.fn(),
    ...overrides,
  };
}

function createMockCommands() {
  return {
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
}

describe("EditStage", () => {
  it("renders scene title in toolbar and word count", () => {
    render(EditStage, {
      store: createMockStore(),
      commands: createMockCommands(),
      onRequestRefinement: vi.fn(),
    });
    // Title appears in both SceneSequencer and toolbar
    const titles = screen.getAllByText("The Confrontation");
    expect(titles.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/words/)).toBeInTheDocument();
  });

  it("renders hint text", () => {
    render(EditStage, {
      store: createMockStore(),
      commands: createMockCommands(),
      onRequestRefinement: vi.fn(),
    });
    expect(screen.getByText("Select text to refine")).toBeInTheDocument();
  });

  it("shows empty state when no chunks", () => {
    const store = createMockStore({
      activeSceneChunks: [],
      sceneChunks: {},
    });
    render(EditStage, {
      store,
      commands: createMockCommands(),
      onRequestRefinement: vi.fn(),
    });
    expect(screen.getByText(/No prose generated/)).toBeInTheDocument();
  });

  it("renders SceneSequencer", () => {
    render(EditStage, {
      store: createMockStore(),
      commands: createMockCommands(),
      onRequestRefinement: vi.fn(),
    });
    // SceneSequencer renders scene titles as buttons
    expect(screen.getByRole("button", { name: /The Confrontation/ })).toBeInTheDocument();
  });
});
