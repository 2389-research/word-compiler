import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import LearnerPanel from "../../src/app/components/LearnerPanel.svelte";
import type { EditPattern } from "../../src/learner/diff.js";

function makeEdit(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    chunkId: "c1",
    sceneId: "s1",
    projectId: "p1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "well",
    editedText: "",
    context: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("LearnerPanel", () => {
  it("shows empty state when no edit patterns", () => {
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
    });
    expect(screen.getByText(/no edit patterns yet/i)).toBeTruthy();
  });

  it("shows 'not enough patterns' when edits exist but none promoted", () => {
    // Only 2 edits — below promotion threshold
    const edits = [makeEdit(), makeEdit()];
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    expect(screen.getByText(/not enough consistent patterns/i)).toBeTruthy();
  });

  it("shows proposals when enough patterns exist", () => {
    // 10 identical CUT_FILLER edits = above threshold (Wilson(10,10) > 0.60)
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    // Should show the suggestion (title and action both contain "kill list")
    expect(screen.getAllByText(/kill list/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Accept")).toBeTruthy();
    expect(screen.getByText("Reject")).toBeTruthy();
  });

  it("shows suggestion count badge", () => {
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    expect(screen.getByText(/1 suggestion/i)).toBeTruthy();
  });

  it("shows confidence percentage", () => {
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    // Should show some percentage (may appear in multiple places)
    const confidenceEls = screen.getAllByText(/%/);
    expect(confidenceEls.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onAcceptProposal when Accept is clicked", async () => {
    const onAccept = vi.fn();
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
      onAcceptProposal: onAccept,
    });
    const acceptBtn = screen.getByText("Accept");
    acceptBtn.click();
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0]![0]).toHaveProperty("action");
  });

  it("shows Applied state after accepting", async () => {
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    screen.getByText("Accept").click();
    await tick();
    // After clicking, the decision text should appear
    expect(screen.getByText("Applied")).toBeTruthy();
  });
});
