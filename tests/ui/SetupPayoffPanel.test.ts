import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SetupPayoffPanel from "../../src/app/components/SetupPayoffPanel.svelte";
import type { NarrativeIR } from "../../src/types/index.js";

function makeIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return {
    sceneId,
    verified: true,
    events: [],
    factsIntroduced: [],
    factsRevealedToReader: [],
    factsWithheld: [],
    characterDeltas: [],
    setupsPlanted: [],
    payoffsExecuted: [],
    characterPositions: {},
    unresolvedTensions: [],
    ...overrides,
  };
}

describe("SetupPayoffPanel", () => {
  it("shows empty state when no verified IRs exist", () => {
    render(SetupPayoffPanel, { sceneIRs: {}, sceneTitles: {}, sceneOrders: {} });
    expect(screen.getByText(/no verified irs/i)).toBeTruthy();
  });

  it("shows dangling setups as active/unresolved", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The locked drawer"] }),
    };
    const titles = { "scene-1": "Opening" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles, sceneOrders: { "scene-1": 0 } });

    expect(screen.getByText("The locked drawer")).toBeTruthy();
    expect(screen.getByText(/planted in Opening/)).toBeTruthy();
    expect(screen.getByText(/active setups/i)).toBeTruthy();
  });

  it("shows resolved payoffs when setup matches a later payoff", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The locked drawer"] }),
      "scene-2": makeIR("scene-2", { payoffsExecuted: ["The locked drawer"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles, sceneOrders: { "scene-1": 0, "scene-2": 1 } });

    expect(screen.getByText("The locked drawer")).toBeTruthy();
    expect(screen.getByText(/resolved payoffs/i)).toBeTruthy();
  });

  it("treats payoff before setup as unresolved (premature payoff)", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { payoffsExecuted: ["The locked drawer"] }),
      "scene-2": makeIR("scene-2", { setupsPlanted: ["The locked drawer"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles, sceneOrders: { "scene-1": 0, "scene-2": 1 } });

    expect(screen.getByText("The locked drawer")).toBeTruthy();
    expect(screen.getByText(/active setups/i)).toBeTruthy();
    expect(screen.queryByText(/resolved payoffs/i)).toBeNull();
  });

  it("skips unverified IRs", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { verified: false, setupsPlanted: ["Hidden clue"] }),
    };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: {}, sceneOrders: {} });
    expect(screen.getByText(/no verified irs/i)).toBeTruthy();
  });

  it("matches payoffs case-insensitively", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The Locked Drawer"] }),
      "scene-2": makeIR("scene-2", { payoffsExecuted: ["the locked drawer"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles, sceneOrders: { "scene-1": 0, "scene-2": 1 } });

    expect(screen.getByText(/resolved payoffs/i)).toBeTruthy();
    expect(screen.queryByText(/active setups/i)).toBeNull();
  });

  it("matches payoffs via substring (setup text is substring of payoff)", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The locked drawer"] }),
      "scene-2": makeIR("scene-2", { payoffsExecuted: ["The locked drawer was finally opened by Alice"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles, sceneOrders: { "scene-1": 0, "scene-2": 1 } });

    expect(screen.getByText(/resolved payoffs/i)).toBeTruthy();
    expect(screen.queryByText(/active setups/i)).toBeNull();
  });

  it("matches payoffs using dash-separator format", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The locked drawer"] }),
      "scene-2": makeIR("scene-2", { payoffsExecuted: ["The locked drawer \u2014 Alice pried it open with a knife"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles, sceneOrders: { "scene-1": 0, "scene-2": 1 } });

    expect(screen.getByText(/resolved payoffs/i)).toBeTruthy();
    expect(screen.queryByText(/active setups/i)).toBeNull();
  });
});
