import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCommands, createMockProjectStore } from "../../../helpers/mockStore.js";

// Stub the review orchestrator factory so we don't call the LLM
vi.mock("../../../../src/review/index.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../../../src/review/index.js");
  return {
    ...actual,
    createReviewOrchestrator: vi.fn(() => ({
      requestReview: vi.fn(),
      cancelAll: vi.fn(),
    })),
  };
});

// Dynamic import path — module created in Task 5a
const CONTROLLER_MODULE = "../../../../src/app/components/stages/draftStageController.svelte.js";

describe.skip("draftStageController — timer leak regression (unskip in Task 5a)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears pending edit-debounce timers on dispose()", async () => {
    const { createDraftStageController } = await import(CONTROLLER_MODULE);
    const store = createMockProjectStore();
    const commands = createMockCommands();
    const controller = createDraftStageController(store, commands);

    expect(vi.getTimerCount()).toBe(0);
    controller.handleUpdateChunk(0, { editedText: "typed text" });
    expect(vi.getTimerCount()).toBe(1);

    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores late debounced callbacks after dispose()", async () => {
    const { createDraftStageController } = await import(CONTROLLER_MODULE);
    const store = createMockProjectStore();
    const commands = createMockCommands();
    const controller = createDraftStageController(store, commands);

    controller.handleUpdateChunk(0, { editedText: "typed text" });
    controller.dispose();
    vi.advanceTimersByTime(2000);
    expect(commands.persistChunk).not.toHaveBeenCalled();
  });
});
