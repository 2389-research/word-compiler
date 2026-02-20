import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IRInspector from "../../src/app/components/IRInspector.svelte";
import { createEmptyNarrativeIR } from "../../src/types/index.js";

function makeIR(overrides = {}) {
  return { ...createEmptyNarrativeIR("scene-1"), ...overrides };
}

describe("IRInspector", () => {
  const defaultProps = {
    ir: null as ReturnType<typeof createEmptyNarrativeIR> | null,
    sceneTitle: "The Confrontation",
    isExtracting: false,
    canExtract: true,
    onExtract: vi.fn(),
    onVerify: vi.fn(),
    onUpdate: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders scene title in header", () => {
    render(IRInspector, defaultProps);
    expect(screen.getByText(/The Confrontation/)).toBeInTheDocument();
  });

  it("shows 'Extract IR' button when no IR and canExtract", () => {
    render(IRInspector, defaultProps);
    expect(screen.getByText("Extract IR")).toBeInTheDocument();
  });

  it("shows 'Re-extract' when IR already exists", () => {
    render(IRInspector, { ...defaultProps, ir: makeIR() });
    expect(screen.getByText("Re-extract")).toBeInTheDocument();
  });

  it("shows 'Extracting...' when isExtracting", () => {
    render(IRInspector, { ...defaultProps, isExtracting: true });
    expect(screen.getByText("Extracting...")).toBeInTheDocument();
  });

  it("disables extract button when canExtract is false", () => {
    render(IRInspector, { ...defaultProps, canExtract: false });
    const btn = screen.getByText("Extract IR");
    expect(btn).toBeDisabled();
  });

  it("calls onExtract when Extract IR clicked", async () => {
    const onExtract = vi.fn();
    render(IRInspector, { ...defaultProps, onExtract });
    await fireEvent.click(screen.getByText("Extract IR"));
    expect(onExtract).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(IRInspector, { ...defaultProps, onClose });
    await fireEvent.click(screen.getByText("✕"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'No IR' badge when ir is null", () => {
    render(IRInspector, defaultProps);
    expect(screen.getByText("No IR")).toBeInTheDocument();
  });

  it("shows 'Unverified' badge for unverified IR", () => {
    render(IRInspector, { ...defaultProps, ir: makeIR({ verified: false }) });
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("shows 'Verified' badge for verified IR", () => {
    render(IRInspector, { ...defaultProps, ir: makeIR({ verified: true }) });
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows Verify button for unverified IR", () => {
    render(IRInspector, { ...defaultProps, ir: makeIR({ verified: false }) });
    expect(screen.getByText("Verify")).toBeInTheDocument();
  });

  it("does not show Verify button for verified IR", () => {
    render(IRInspector, { ...defaultProps, ir: makeIR({ verified: true }) });
    expect(screen.queryByText("Verify")).toBeNull();
  });

  it("calls onVerify when Verify button clicked", async () => {
    const onVerify = vi.fn();
    render(IRInspector, { ...defaultProps, ir: makeIR({ verified: false }), onVerify });
    await fireEvent.click(screen.getByText("Verify"));
    expect(onVerify).toHaveBeenCalledOnce();
  });

  it("renders IR events when IR has data", () => {
    const ir = makeIR({ events: ["Alice entered the room", "Bob left"] });
    render(IRInspector, { ...defaultProps, ir });
    expect(screen.getByText("Alice entered the room")).toBeInTheDocument();
    expect(screen.getByText("Bob left")).toBeInTheDocument();
  });

  it("renders unresolved tensions", () => {
    const ir = makeIR({ unresolvedTensions: ["Who sent the letter?"] });
    render(IRInspector, { ...defaultProps, ir });
    expect(screen.getByText("Who sent the letter?")).toBeInTheDocument();
  });

  it("renders character deltas", () => {
    const ir = makeIR({
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Bob has been lying",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });
    render(IRInspector, { ...defaultProps, ir });
    expect(screen.getByText("Bob has been lying")).toBeInTheDocument();
  });
});
