import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AtlasPane from "../../src/app/components/AtlasPane.svelte";

vi.mock("svelte-codemirror-editor", () => ({
  // Svelte 5 components are functions; provide a no-op component
  default: function CodeMirrorStub() {},
}));
vi.mock("@codemirror/lang-json", () => ({ json: () => [] }));
vi.mock("@codemirror/theme-one-dark", () => ({ oneDark: [] }));

function createMockStore(overrides = {}) {
  return {
    bible: null,
    activeScenePlan: null,
    chapterArc: null,
    activeSceneIndex: 0,
    scenes: [],
    loadFile: vi.fn(),
    saveFile: vi.fn(),
    setBible: vi.fn(),
    setScenePlan: vi.fn(),
    addScenePlan: vi.fn(),
    setChapterArc: vi.fn(),
    setError: vi.fn(),
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
  };
}

describe("AtlasPane", () => {
  it("renders 'Project Atlas' title", () => {
    render(AtlasPane, { store: createMockStore(), commands: createMockCommands(), onBootstrap: vi.fn() });
    expect(screen.getByText("Project Atlas")).toBeInTheDocument();
  });

  it("shows 'New Brief' button when onAuthor is provided", () => {
    render(AtlasPane, {
      store: createMockStore(),
      commands: createMockCommands(),
      onBootstrap: vi.fn(),
      onAuthor: vi.fn(),
    });
    expect(screen.getByText("New Brief")).toBeInTheDocument();
  });

  it("shows 'Bootstrap' button when onAuthor is not provided", () => {
    render(AtlasPane, { store: createMockStore(), commands: createMockCommands(), onBootstrap: vi.fn() });
    expect(screen.getByText("Bootstrap")).toBeInTheDocument();
  });

  it("renders tab buttons for Brief, Section, Arc, JSON", () => {
    render(AtlasPane, { store: createMockStore(), commands: createMockCommands(), onBootstrap: vi.fn() });
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(screen.getByText("Arc")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("shows bible empty state when no bible exists on bible tab", () => {
    render(AtlasPane, { store: createMockStore(), commands: createMockCommands(), onBootstrap: vi.fn() });
    expect(screen.getByText("No essay brief yet.")).toBeInTheDocument();
  });
});
