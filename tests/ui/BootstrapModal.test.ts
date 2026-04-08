import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BootstrapModal from "../../src/app/components/BootstrapModal.svelte";

// ─── Module mocks ──────────────────────────────────────

vi.mock("../../src/llm/client.js", () => ({
  generateStream: vi.fn(),
}));

vi.mock("../../src/bootstrap/index.js", () => ({
  buildBootstrapPrompt: vi.fn(() => ({
    systemMessage: "mock-system",
    userMessage: "mock-user",
    temperature: 0.7,
    topP: 0.92,
    maxTokens: 16384,
    model: "claude-sonnet-4-6",
  })),
  parseBootstrapResponse: vi.fn(() => ({
    characters: [{ name: "Alice", role: "protagonist" }],
    locations: [{ name: "The Tavern" }],
  })),
  bootstrapToBible: vi.fn(() => ({
    projectId: "test-proj",
    version: 1,
    characters: [],
    styleGuide: {},
    narrativeRules: {},
    locations: [],
    createdAt: new Date().toISOString(),
  })),
}));

import { bootstrapToBible, buildBootstrapPrompt, parseBootstrapResponse } from "../../src/bootstrap/index.js";
import { generateStream } from "../../src/llm/client.js";

// ─── Helpers ───────────────────────────────────────────

function createMockStore() {
  return {
    bootstrapModalOpen: true,
    project: { id: "test-proj" },
    setBootstrapOpen: vi.fn(),
    setBible: vi.fn(),
    setError: vi.fn(),
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

describe("BootstrapModal", () => {
  it("renders synopsis textarea when not loading", () => {
    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("renders modal header text", () => {
    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    expect(screen.getByText("Bootstrap Bible from Synopsis")).toBeInTheDocument();
  });

  it("renders instruction text", () => {
    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    expect(screen.getByText(/Paste your story synopsis/)).toBeInTheDocument();
  });

  it("Bootstrap Bible button is disabled when synopsis is empty", () => {
    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const btn = screen.getByText("Bootstrap Bible");
    expect(btn).toBeDisabled();
  });

  it("Bootstrap Bible button is enabled when synopsis has text", async () => {
    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "A noir detective story." } });

    const btn = screen.getByText("Bootstrap Bible");
    expect(btn).toBeEnabled();
  });

  it("shows 'Waiting for first token...' when loading starts", async () => {
    // Make generateStream hang so we stay in loading state
    vi.mocked(generateStream).mockImplementation(() => new Promise(() => {}));

    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    // Type synopsis and click bootstrap
    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "A noir detective story." } });

    const btn = screen.getByText("Bootstrap Bible");
    await fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("Waiting for first token...")).toBeInTheDocument();
    });
  });

  it("shows 'Bootstrapping...' on the button during loading", async () => {
    vi.mocked(generateStream).mockImplementation(() => new Promise(() => {}));

    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "A noir detective story." } });

    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    await waitFor(() => {
      expect(screen.getByText("Bootstrapping...")).toBeInTheDocument();
    });
  });

  it("calls buildBootstrapPrompt with the synopsis text", async () => {
    vi.mocked(generateStream).mockImplementation(() => new Promise(() => {}));

    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, {
      target: { value: "A detective in a jazz bar." },
    });
    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    expect(buildBootstrapPrompt).toHaveBeenCalledWith("A detective in a jazz bar.");
  });

  it("parse error displays via ErrorBanner", async () => {
    const parseError = "Unexpected token at position 42";

    vi.mocked(generateStream).mockImplementation(async (_payload, callbacks) => {
      callbacks.onToken("not valid json{{{");
      callbacks.onDone({ input_tokens: 10, output_tokens: 20 }, "end_turn");
    });

    vi.mocked(parseBootstrapResponse).mockReturnValue({
      error: parseError,
      rawText: "not valid json{{{",
    });

    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "Some story." } });
    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Parse failed/)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(parseError))).toBeInTheDocument();
    });
  });

  it("does not call commands.saveBible when parse fails", async () => {
    vi.mocked(generateStream).mockImplementation(async (_payload, callbacks) => {
      callbacks.onToken("broken");
      callbacks.onDone({ input_tokens: 5, output_tokens: 5 }, "end_turn");
    });

    vi.mocked(parseBootstrapResponse).mockReturnValue({
      error: "Bad JSON",
      rawText: "broken",
    });

    const store = createMockStore();
    const commands = createMockCommands();
    render(BootstrapModal, { store, commands });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "Some story." } });
    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(commands.saveBible).not.toHaveBeenCalled();
  });

  it("calls commands.saveBible on successful bootstrap", async () => {
    const fakeBible = {
      projectId: "test-proj",
      version: 1,
      characters: [],
      styleGuide: {},
      narrativeRules: {},
      locations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    vi.mocked(generateStream).mockImplementation(async (_payload, callbacks) => {
      callbacks.onToken('{"characters":[]}');
      callbacks.onDone({ input_tokens: 100, output_tokens: 200 }, "end_turn");
    });

    vi.mocked(parseBootstrapResponse).mockReturnValue({
      thesis: "A great argument",
      sections: [{ heading: "Intro", purpose: "Set up", keyPoints: ["point 1"] }],
      suggestedKillList: ["delve"],
    });

    vi.mocked(bootstrapToBible).mockReturnValue(fakeBible as any);

    const store = createMockStore();
    const commands = createMockCommands();
    render(BootstrapModal, { store, commands });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "A great story." } });
    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    await waitFor(() => {
      expect(commands.saveBible).toHaveBeenCalledWith(fakeBible);
    });
  });

  it("does not render modal contents when bootstrapModalOpen is false", () => {
    const store = createMockStore();
    store.bootstrapModalOpen = false;
    render(BootstrapModal, { store, commands: createMockCommands() });

    expect(screen.queryByText("Bootstrap Bible from Synopsis")).toBeNull();
  });

  it("shows Cancel button that calls handleClose", async () => {
    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const cancelBtn = screen.getByText("Cancel");
    expect(cancelBtn).toBeInTheDocument();

    await fireEvent.click(cancelBtn);
    expect(store.setBootstrapOpen).toHaveBeenCalledWith(false);
  });

  it("displays streamed text as tokens arrive", async () => {
    vi.mocked(generateStream).mockImplementation(async (_payload, callbacks) => {
      callbacks.onToken("Hello ");
      callbacks.onToken("world");
      // Never call onDone so we stay in loading state to inspect stream text
      return new Promise(() => {});
    });

    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "A story." } });
    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });

  it("shows error banner when generateStream throws", async () => {
    vi.mocked(generateStream).mockRejectedValue(new Error("Network failure"));

    const store = createMockStore();
    render(BootstrapModal, { store, commands: createMockCommands() });

    const textarea = screen.getByPlaceholderText(/Example synopsis/);
    await fireEvent.input(textarea, { target: { value: "A story." } });
    await fireEvent.click(screen.getByText("Bootstrap Bible"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Network failure/)).toBeInTheDocument();
    });
  });
});
