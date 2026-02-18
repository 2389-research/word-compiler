import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ForwardSimulator } from "../../src/app/components/ForwardSimulator.js";
import { createEmptyNarrativeIR, createEmptyScenePlan } from "../../src/types/index.js";

function makeScene(id: string, title: string, ir = null as ReturnType<typeof createEmptyNarrativeIR> | null) {
  const plan = { ...createEmptyScenePlan("proj-1"), id, title };
  return { plan, ir, sceneOrder: 0 };
}

describe("ForwardSimulator", () => {
  it("shows empty state when no scenes", () => {
    render(<ForwardSimulator scenes={[]} activeSceneIndex={0} onSelectScene={vi.fn()} />);
    expect(screen.getByText(/No scenes/)).toBeInTheDocument();
  });

  it("renders scene titles", () => {
    const scenes = [makeScene("s1", "Opening"), makeScene("s2", "Rising Action")];
    render(<ForwardSimulator scenes={scenes} activeSceneIndex={0} onSelectScene={vi.fn()} />);
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("Rising Action")).toBeInTheDocument();
  });

  it("calls onSelectScene when a scene node is clicked", () => {
    const onSelectScene = vi.fn();
    const scenes = [makeScene("s1", "Opening"), makeScene("s2", "Rising Action")];
    render(<ForwardSimulator scenes={scenes} activeSceneIndex={0} onSelectScene={onSelectScene} />);
    fireEvent.click(screen.getByText("Rising Action"));
    expect(onSelectScene).toHaveBeenCalledWith(1);
  });

  it("shows 'No IR' label for scenes without IR", () => {
    const scenes = [makeScene("s1", "Opening", null)];
    render(<ForwardSimulator scenes={scenes} activeSceneIndex={0} onSelectScene={vi.fn()} />);
    expect(screen.getByText("No IR")).toBeInTheDocument();
  });

  it("shows scene number labels", () => {
    const scenes = [makeScene("s1", "Opening"), makeScene("s2", "Second")];
    render(<ForwardSimulator scenes={scenes} activeSceneIndex={0} onSelectScene={vi.fn()} />);
    expect(screen.getByText("Scene 1")).toBeInTheDocument();
    expect(screen.getByText("Scene 2")).toBeInTheDocument();
  });

  it("shows facts revealed count for verified IR", () => {
    const ir = { ...createEmptyNarrativeIR("s1"), verified: true, factsRevealedToReader: ["fact 1", "fact 2"] };
    const scenes = [makeScene("s1", "Opening", ir)];
    render(<ForwardSimulator scenes={scenes} activeSceneIndex={0} onSelectScene={vi.fn()} />);
    expect(screen.getByText(/2 facts revealed/)).toBeInTheDocument();
  });

  it("renders arrow separators between scenes", () => {
    const scenes = [makeScene("s1", "A"), makeScene("s2", "B"), makeScene("s3", "C")];
    render(<ForwardSimulator scenes={scenes} activeSceneIndex={0} onSelectScene={vi.fn()} />);
    const arrows = screen.getAllByText("→");
    expect(arrows).toHaveLength(2); // n-1 arrows
  });
});
