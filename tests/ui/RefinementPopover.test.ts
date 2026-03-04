import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefinementPopover from "../../src/app/components/RefinementPopover.svelte";
import type { RefinementVariant } from "../../src/review/refineTypes.js";

const defaultProps = {
  selectedText: "The rain fell in sheets.",
  loading: false,
  variants: [] as RefinementVariant[],
  position: { top: 100, left: 50 },
  onRefine: vi.fn(),
  onCut: vi.fn(),
  onAcceptVariant: vi.fn(),
  onKeepOriginal: vi.fn(),
  onCancel: vi.fn(),
};

describe("RefinementPopover", () => {
  it("shows selected text preview in idle state", () => {
    render(RefinementPopover, { ...defaultProps });
    expect(screen.getByText(/The rain fell/)).toBeInTheDocument();
  });

  it("renders all chip labels", () => {
    render(RefinementPopover, { ...defaultProps });
    expect(screen.getByText("Word Choice")).toBeInTheDocument();
    expect(screen.getByText("Rhythm")).toBeInTheDocument();
    expect(screen.getByText("Pacing")).toBeInTheDocument();
    expect(screen.getByText("Voice Drift")).toBeInTheDocument();
    expect(screen.getByText("Clich\u00e9")).toBeInTheDocument();
    expect(screen.getByText("Cut This")).toBeInTheDocument();
  });

  it("renders Refine and Cancel buttons", () => {
    render(RefinementPopover, { ...defaultProps });
    expect(screen.getByText("Refine")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onCut when Cut This chip is clicked", async () => {
    const onCut = vi.fn();
    render(RefinementPopover, { ...defaultProps, onCut });
    await fireEvent.click(screen.getByText("Cut This"));
    expect(onCut).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(RefinementPopover, { ...defaultProps, onCancel });
    await fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows loading spinner", () => {
    render(RefinementPopover, { ...defaultProps, loading: true });
    expect(screen.getByText("Generating variants...")).toBeInTheDocument();
  });

  it("shows variants when available", () => {
    const variants: RefinementVariant[] = [
      { text: "The rain hammered.", rationale: "Stronger verb", killListClean: true, killListViolations: [] },
      { text: "Rain pelted the glass.", rationale: "Active voice", killListClean: true, killListViolations: [] },
    ];
    render(RefinementPopover, { ...defaultProps, variants });
    // First variant is shown by default
    expect(screen.getByText("The rain hammered.")).toBeInTheDocument();
    expect(screen.getByText("Stronger verb")).toBeInTheDocument();
    // "1 more variant" expander
    expect(screen.getByText("1 more variant")).toBeInTheDocument();
  });

  it("shows kill list warning badge on flagged variants", () => {
    const variants: RefinementVariant[] = [
      {
        text: "He suddenly ran.",
        rationale: "more dramatic",
        killListClean: false,
        killListViolations: ["suddenly found"],
      },
    ];
    render(RefinementPopover, { ...defaultProps, variants });
    expect(screen.getByText("Kill list")).toBeInTheDocument();
  });

  it("shows Keep Original button when variants are displayed", () => {
    const variants: RefinementVariant[] = [
      { text: "alt text", rationale: "reason", killListClean: true, killListViolations: [] },
    ];
    render(RefinementPopover, { ...defaultProps, variants });
    expect(screen.getByText("Keep Original")).toBeInTheDocument();
  });

  it("calls onAcceptVariant when Accept is clicked", async () => {
    const onAcceptVariant = vi.fn();
    const variants: RefinementVariant[] = [
      { text: "better text", rationale: "reason", killListClean: true, killListViolations: [] },
    ];
    render(RefinementPopover, { ...defaultProps, variants, onAcceptVariant });
    await fireEvent.click(screen.getByText("Accept"));
    expect(onAcceptVariant).toHaveBeenCalledWith(variants[0]);
  });

  it("truncates long selected text", () => {
    const longText = "A".repeat(100);
    render(RefinementPopover, { ...defaultProps, selectedText: longText });
    expect(screen.getByText(/\.\.\."/)).toBeInTheDocument();
  });
});
