import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AnnotationTooltip from "../../src/app/components/AnnotationTooltip.svelte";
import { makeEditorialAnnotation } from "../../src/app/stories/factories.js";

function renderTooltip(overrides: Parameters<typeof makeEditorialAnnotation>[0] = {}, props = {}) {
  const annotation = makeEditorialAnnotation(overrides);
  return render(AnnotationTooltip, {
    annotation,
    position: { top: 100, left: 50, anchorBottom: 96 },
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    ...props,
  });
}

describe("AnnotationTooltip", () => {
  it("renders severity text", () => {
    renderTooltip({ severity: "warning" });
    expect(screen.getByText("warning")).toBeInTheDocument();
  });

  it("renders category with underscores replaced by spaces", () => {
    renderTooltip({ category: "show_dont_tell" });
    expect(screen.getByText("show dont tell")).toBeInTheDocument();
  });

  it("renders the annotation message", () => {
    renderTooltip({ message: "Prose feels monotonous here" });
    expect(screen.getByText("Prose feels monotonous here")).toBeInTheDocument();
  });

  it("shows suggestion text when present", () => {
    renderTooltip({ suggestion: "Replace with concrete detail" });
    expect(screen.getByText("Suggestion:")).toBeInTheDocument();
    expect(screen.getByText(/Replace with concrete detail/)).toBeInTheDocument();
  });

  it("shows Apply button only when suggestion is present", () => {
    renderTooltip({ suggestion: "better word" });
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("does not show Apply button when no suggestion", () => {
    renderTooltip({ suggestion: null });
    expect(screen.queryByText("Apply")).not.toBeInTheDocument();
  });

  it("always shows Dismiss button", () => {
    renderTooltip({ suggestion: null });
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("calls onDismiss with annotation id when Dismiss is clicked", async () => {
    const onDismiss = vi.fn();
    const annotation = makeEditorialAnnotation({ suggestion: null });
    render(AnnotationTooltip, {
      annotation,
      position: { top: 0, left: 0, anchorBottom: 0 },
      onAccept: vi.fn(),
      onDismiss,
    });
    await fireEvent.click(screen.getByText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledWith(annotation.id);
  });

  it("calls onAccept with annotation id when Apply is clicked", async () => {
    const onAccept = vi.fn();
    const annotation = makeEditorialAnnotation({ suggestion: "better" });
    render(AnnotationTooltip, {
      annotation,
      position: { top: 0, left: 0, anchorBottom: 0 },
      onAccept,
      onDismiss: vi.fn(),
    });
    await fireEvent.click(screen.getByText("Apply"));
    expect(onAccept).toHaveBeenCalledWith(annotation.id);
  });
});
