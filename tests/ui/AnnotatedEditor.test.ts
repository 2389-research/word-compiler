import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AnnotatedEditor from "../../src/app/components/AnnotatedEditor.svelte";

// TipTap/ProseMirror requires a real DOM for contenteditable — jsdom
// provides a basic approximation. Full interaction testing (hover → tooltip,
// squiggle rendering) is covered by E2E tests (e2e/review.spec.ts).

describe("AnnotatedEditor", () => {
  it("mounts without crashing", () => {
    const { container } = render(AnnotatedEditor, {
      text: "Some sample text for the editor.",
      annotations: [],
      onTextChange: vi.fn(),
    });
    expect(container.querySelector(".annotated-editor-wrapper")).toBeInTheDocument();
  });

  it("renders the editor element", () => {
    const { container } = render(AnnotatedEditor, {
      text: "Hello world.",
      annotations: [],
    });
    expect(container.querySelector(".annotated-editor")).toBeInTheDocument();
  });

  it("accepts readonly prop without error", () => {
    const { container } = render(AnnotatedEditor, {
      text: "Read-only text.",
      annotations: [],
      readonly: true,
    });
    expect(container.querySelector(".annotated-editor-wrapper")).toBeInTheDocument();
  });
});
