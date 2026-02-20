import { render, screen } from "@testing-library/svelte";
import { beforeAll, describe, expect, it, vi } from "vitest";
import DraftingDesk from "../../src/app/components/DraftingDesk.svelte";
import { createEmptyScenePlan } from "../../src/types/index.js";

beforeAll(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

function defaultProps() {
  return {
    chunks: [] as any[],
    scenePlan: createEmptyScenePlan("proj-1"),
    sceneStatus: "drafting" as const,
    isGenerating: false,
    canGenerate: true,
    gateMessages: [] as string[],
    auditFlags: [] as any[],
    sceneIR: null,
    isExtractingIR: false,
    onGenerate: vi.fn(),
    onUpdateChunk: vi.fn(),
    onRemoveChunk: vi.fn(),
    onRunAudit: vi.fn(),
    onCompleteScene: vi.fn(),
    onAutopilot: vi.fn(),
    onCancelAutopilot: vi.fn(),
    onOpenIRInspector: vi.fn(),
    onExtractIR: vi.fn(),
    isAutopilot: false,
  };
}

describe("DraftingDesk", () => {
  it("shows empty state when no chunks", () => {
    render(DraftingDesk, defaultProps());
    expect(screen.getByText("Load a Bible and Scene Plan, then generate your first chunk.")).toBeInTheDocument();
  });

  it("shows 'Generate Chunk 1' button when canGenerate and no chunks", () => {
    render(DraftingDesk, defaultProps());
    expect(screen.getByText("Generate Chunk 1")).toBeInTheDocument();
  });

  it("Generate button is disabled when canGenerate is false", () => {
    render(DraftingDesk, { ...defaultProps(), canGenerate: false });
    expect(screen.getByText("Generate Chunk 1")).toBeDisabled();
  });

  it("shows 'Run Audit' button", () => {
    render(DraftingDesk, defaultProps());
    expect(screen.getByText("Run Audit")).toBeInTheDocument();
  });

  it("shows 'Generating...' text when isGenerating", () => {
    render(DraftingDesk, { ...defaultProps(), isGenerating: true });
    expect(screen.getByText("Generating...")).toBeInTheDocument();
  });
});
