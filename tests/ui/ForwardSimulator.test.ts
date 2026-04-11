import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ForwardSimulator from "../../src/app/components/ForwardSimulator.svelte";
import { createEmptyNarrativeIR, createEmptyScenePlan } from "../../src/types/index.js";

function makeScene(id: string, title: string, ir = null as ReturnType<typeof createEmptyNarrativeIR> | null) {
  const plan = { ...createEmptyScenePlan("proj-1"), id, title };
  return { plan, ir, sceneOrder: 0 };
}

describe("ForwardSimulator", () => {
  it("shows empty state when no scenes", () => {
    render(ForwardSimulator, { scenes: [], activeSceneIndex: 0, onSelectScene: vi.fn() });
    expect(screen.getByText(/No sections/)).toBeInTheDocument();
  });

  it("renders scene titles", () => {
    const scenes = [makeScene("s1", "Opening"), makeScene("s2", "Rising Action")];
    render(ForwardSimulator, { scenes, activeSceneIndex: 0, onSelectScene: vi.fn() });
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("Rising Action")).toBeInTheDocument();
  });

  it("calls onSelectScene when a scene node is clicked", async () => {
    const onSelectScene = vi.fn();
    const scenes = [makeScene("s1", "Opening"), makeScene("s2", "Rising Action")];
    render(ForwardSimulator, { scenes, activeSceneIndex: 0, onSelectScene });
    await fireEvent.click(screen.getByText("Rising Action"));
    expect(onSelectScene).toHaveBeenCalledWith(1);
  });

  it("shows 'No IR' label for scenes without IR", () => {
    const scenes = [makeScene("s1", "Opening", null)];
    render(ForwardSimulator, { scenes, activeSceneIndex: 0, onSelectScene: vi.fn() });
    expect(screen.getByText("No IR")).toBeInTheDocument();
  });

  it("shows section number labels", () => {
    const scenes = [makeScene("s1", "Opening"), makeScene("s2", "Second")];
    render(ForwardSimulator, { scenes, activeSceneIndex: 0, onSelectScene: vi.fn() });
    expect(screen.getByText("Section 1")).toBeInTheDocument();
    expect(screen.getByText("Section 2")).toBeInTheDocument();
  });

  it("shows facts count for verified IR", () => {
    const ir = { ...createEmptyNarrativeIR("s1"), verified: true, factsRevealedToReader: ["fact 1", "fact 2"] };
    const scenes = [makeScene("s1", "Opening", ir)];
    render(ForwardSimulator, { scenes, activeSceneIndex: 0, onSelectScene: vi.fn() });
    expect(screen.getByText(/2 facts/)).toBeInTheDocument();
  });

  it("renders connector separators between scenes", () => {
    const scenes = [makeScene("s1", "A"), makeScene("s2", "B"), makeScene("s3", "C")];
    render(ForwardSimulator, { scenes, activeSceneIndex: 0, onSelectScene: vi.fn() });
    const arrows = screen.getAllByText("↓");
    expect(arrows).toHaveLength(2);
  });
});
