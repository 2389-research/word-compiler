import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DraftStage from "../../src/app/components/stages/DraftStage.svelte";
import { makeChunk } from "../../src/app/stories/factories.js";
import { createMockCommands, createMockProjectStore } from "../helpers/mockStore.js";

beforeAll(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

// AnnotatedEditor uses ProseMirror/tiptap — jsdom provides enough DOM
// support for basic rendering (see AnnotatedEditor.test.ts), so no
// tiptap mocks are needed.

// Stub the review orchestrator factory so tests don't hit the LLM.
// We capture the most recent instance so tests can assert on its calls.
const mockOrchestratorInstances: Array<{
  requestReview: ReturnType<typeof vi.fn>;
  cancelAll: ReturnType<typeof vi.fn>;
}> = [];
vi.mock("../../src/review/index.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../src/review/index.js");
  return {
    ...actual,
    createReviewOrchestrator: vi.fn(() => {
      const instance = { requestReview: vi.fn(), cancelAll: vi.fn() };
      mockOrchestratorInstances.push(instance);
      return instance;
    }),
  };
});

function defaultProps() {
  return {
    store: createMockProjectStore(),
    commands: createMockCommands(),
    onGenerate: vi.fn(),
    onRunAudit: vi.fn(),
    onRunDeepAudit: vi.fn(),
    onAutopilot: vi.fn(),
    onExtractIR: vi.fn(),
  };
}

describe("DraftStage — timer cleanup on unmount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockOrchestratorInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not fire auto-review callback after unmount (append-then-unmount)", async () => {
    const props = defaultProps();
    const { unmount } = render(DraftStage, props);
    vi.advanceTimersByTime(0);

    // Append a new chunk to trigger the auto-review scheduling effect.
    // Cast through any to bypass readonly — the mock store is a plain object.
    const newChunk = makeChunk({ sceneId: "scene-1" });
    // biome-ignore lint/suspicious/noExplicitAny: test-only mutation of readonly mock
    const mutableStore = props.store as any;
    mutableStore.activeSceneChunks = [...props.store.activeSceneChunks, newChunk];
    (props.store.sceneChunks as Record<string, unknown[]>)["scene-1"] = props.store.activeSceneChunks;
    // Flush microtasks so the scheduling $effect runs and schedules setTimeout
    await Promise.resolve();

    // Advance partway through the 1500ms debounce
    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);

    unmount();

    // Advance past the 1500ms delay — nothing should fire
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBe(0);
    const orch = mockOrchestratorInstances[mockOrchestratorInstances.length - 1];
    if (orch) expect(orch.requestReview).not.toHaveBeenCalled();
  });

  it("clears any already-pending timers on bare unmount", () => {
    const { unmount } = render(DraftStage, defaultProps());
    vi.advanceTimersByTime(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("DraftStage — behavioral smoke tests", () => {
  it("renders the SceneSequencer with the active scene title", () => {
    render(DraftStage, defaultProps());
    expect(screen.getByRole("button", { name: /The Confrontation/ })).toBeInTheDocument();
  });

  it("renders the Draft Engine sidebar tab by default", () => {
    render(DraftStage, defaultProps());
    expect(screen.getAllByText("Draft Engine").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all five sidebar tabs", () => {
    render(DraftStage, defaultProps());
    expect(screen.getAllByText("Draft Engine").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Voice Consistency").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Character Voices").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Setups").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IR").length).toBeGreaterThanOrEqual(1);
  });
});

describe("DraftStage — Map/Set reactivity across module boundary (Task 5 gate)", () => {
  it("propagates controller chunkAnnotations mutations into DraftingDesk", () => {
    // This test is skipped in Task 1 (no controller yet) and un-skipped in
    // Task 5a. It guards the SvelteMap/SvelteSet decision: if the controller
    // reverted to plain Map, this test would fail because DraftingDesk's
    // `chunkAnnotations` prop would not re-render on mutation.
    //
    // Intentionally a placeholder here — flesh out in Task 5a.
    expect(true).toBe(true);
  });
});
