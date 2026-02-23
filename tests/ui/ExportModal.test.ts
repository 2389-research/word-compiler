import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ExportModal from "../../src/app/components/ExportModal.svelte";
import type { SceneEntry } from "../../src/app/store/project.svelte.js";
import type { ChapterArc, Chunk } from "../../src/types/index.js";
import { createEmptyScenePlan, generateId } from "../../src/types/index.js";

// ─── Factories ──────────────────────────────────────────

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: generateId(),
    sceneId: "scene-1",
    sequenceNumber: 0,
    generatedText: "The rain fell steadily against the old windows.",
    editedText: null,
    humanNotes: null,
    status: "accepted",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "abc123",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSceneEntry(id: string, order: number): SceneEntry {
  return {
    plan: { ...createEmptyScenePlan("proj-1"), id, title: `Scene ${order + 1}` },
    status: "drafting",
    sceneOrder: order,
  };
}

function makeChapterArc(): ChapterArc {
  return {
    id: generateId(),
    projectId: "proj-1",
    chapterNumber: 1,
    workingTitle: "The Letter",
    narrativeFunction: "Inciting incident",
    dominantRegister: "Restrained",
    pacingTarget: "Slow build",
    endingPosture: "Cliffhanger",
    readerStateEntering: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    readerStateExiting: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    sourcePrompt: null,
  };
}

// ─── Mock Store ─────────────────────────────────────────

function createMockStore(
  opts: { scenes?: SceneEntry[]; sceneChunks?: Record<string, Chunk[]>; chapterArc?: ChapterArc | null } = {},
) {
  return {
    scenes: opts.scenes ?? [],
    sceneChunks: opts.sceneChunks ?? {},
    chapterArc: opts.chapterArc ?? null,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe("ExportModal", () => {
  it('renders "Export Prose" header when open', () => {
    render(ExportModal, { open: true, onClose: vi.fn(), store: createMockStore() });
    expect(screen.getByText("Export Prose")).toBeInTheDocument();
  });

  it("shows Markdown selected by default in format RadioGroup", () => {
    render(ExportModal, { open: true, onClose: vi.fn(), store: createMockStore() });
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("Plain Text")).toBeInTheDocument();
    // Markdown radio should be checked
    const markdownRadio = screen.getByLabelText("Markdown") as HTMLInputElement;
    expect(markdownRadio.checked).toBe(true);
  });

  it("shows empty state when store has no chunks", () => {
    render(ExportModal, { open: true, onClose: vi.fn(), store: createMockStore() });
    expect(screen.getByText(/no prose to export/i)).toBeInTheDocument();
  });

  it("shows word count and .md extension when prose exists", () => {
    const scene = makeSceneEntry("scene-1", 0);
    const chunk = makeChunk({ sceneId: "scene-1" });
    const store = createMockStore({
      scenes: [scene],
      sceneChunks: { "scene-1": [chunk] },
      chapterArc: makeChapterArc(),
    });
    render(ExportModal, { open: true, onClose: vi.fn(), store });
    // Meta line shows "N words · .md"
    expect(screen.getByText(/\d+ words · \.md/)).toBeInTheDocument();
  });

  it("shows truncated preview for long content", () => {
    const longText = "word ".repeat(200).trim(); // 200 words, >500 chars
    const scene = makeSceneEntry("scene-1", 0);
    const chunk = makeChunk({ sceneId: "scene-1", generatedText: longText });
    const store = createMockStore({
      scenes: [scene],
      sceneChunks: { "scene-1": [chunk] },
      chapterArc: makeChapterArc(),
    });
    render(ExportModal, { open: true, onClose: vi.fn(), store });
    // Preview should end with ellipsis character (…)
    const preview = screen.getByText(/…$/);
    expect(preview).toBeInTheDocument();
  });

  it("switching to Plain Text changes format to .txt", async () => {
    const scene = makeSceneEntry("scene-1", 0);
    const chunk = makeChunk({ sceneId: "scene-1" });
    const store = createMockStore({
      scenes: [scene],
      sceneChunks: { "scene-1": [chunk] },
      chapterArc: makeChapterArc(),
    });
    render(ExportModal, { open: true, onClose: vi.fn(), store });
    // Switch to Plain Text
    await fireEvent.click(screen.getByLabelText("Plain Text"));
    expect(screen.getByText(/\.txt/)).toBeInTheDocument();
  });

  it("Copy and Download buttons are disabled when no prose", () => {
    render(ExportModal, { open: true, onClose: vi.fn(), store: createMockStore() });
    const copyBtn = screen.getByText("Copy to Clipboard");
    const downloadBtn = screen.getByText("Download File");
    expect(copyBtn).toBeDisabled();
    expect(downloadBtn).toBeDisabled();
  });

  it("Cancel button calls onClose", async () => {
    const onClose = vi.fn();
    render(ExportModal, { open: true, onClose, store: createMockStore() });
    await fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
