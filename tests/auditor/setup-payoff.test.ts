import { describe, expect, it } from "vitest";
import { checkDanglingSetups, checkSetupPayoff } from "../../src/auditor/setupPayoff.js";
import {
  type Bible,
  createEmptyBible,
  createEmptyNarrativeIR,
  createEmptyScenePlan,
  type NarrativeIR,
} from "../../src/types/index.js";

function makeBibleWithSetup(sceneId: string, payoffSceneId: string | null = null): Bible {
  const bible = createEmptyBible("proj-1");
  return {
    ...bible,
    narrativeRules: {
      ...bible.narrativeRules,
      setups: [
        {
          id: "setup-1",
          description: "The hidden key under the mat",
          plantedInScene: sceneId,
          payoffInScene: payoffSceneId,
          status: payoffSceneId ? "paid-off" : "planted",
        },
      ],
    },
  };
}

function makeVerifiedIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return { ...createEmptyNarrativeIR(sceneId), verified: true, ...overrides };
}

describe("checkSetupPayoff", () => {
  it("returns no flags when planted setup appears in IR.setupsPlanted", () => {
    const sceneId = "scene-1";
    const bible = makeBibleWithSetup(sceneId);
    const plan = { ...createEmptyScenePlan("proj-1"), id: sceneId };
    const ir = makeVerifiedIR(sceneId, { setupsPlanted: ["The hidden key under the mat was placed"] });

    const flags = checkSetupPayoff(ir, plan, bible);
    expect(flags).toHaveLength(0);
  });

  it("flags when planted setup not found in IR.setupsPlanted", () => {
    const sceneId = "scene-1";
    const bible = makeBibleWithSetup(sceneId);
    const plan = { ...createEmptyScenePlan("proj-1"), id: sceneId };
    const ir = makeVerifiedIR(sceneId, { setupsPlanted: [] });

    const flags = checkSetupPayoff(ir, plan, bible);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.category).toBe("setup_missing");
    expect(flags[0]!.message).toContain("hidden key");
  });

  it("flags when payoff scene doesn't have the payoff in IR", () => {
    const plantScene = "scene-1";
    const payoffScene = "scene-2";
    const bible = makeBibleWithSetup(plantScene, payoffScene);
    const plan = { ...createEmptyScenePlan("proj-1"), id: payoffScene };
    const ir = makeVerifiedIR(payoffScene, { payoffsExecuted: [] });

    const flags = checkSetupPayoff(ir, plan, bible);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.category).toBe("payoff_missing");
    expect(flags[0]!.message).toContain("Dangling setup risk");
  });

  it("no flags when payoff correctly recorded in IR", () => {
    const plantScene = "scene-1";
    const payoffScene = "scene-2";
    const bible = makeBibleWithSetup(plantScene, payoffScene);
    const plan = { ...createEmptyScenePlan("proj-1"), id: payoffScene };
    const ir = makeVerifiedIR(payoffScene, { payoffsExecuted: ["The hidden key under the mat was found"] });

    const flags = checkSetupPayoff(ir, plan, bible);
    expect(flags).toHaveLength(0);
  });

  it("uses substring matching for flexible comparison", () => {
    const sceneId = "scene-1";
    const bible = makeBibleWithSetup(sceneId);
    const plan = { ...createEmptyScenePlan("proj-1"), id: sceneId };
    // "hidden key" is a substring of the setup description
    const ir = makeVerifiedIR(sceneId, { setupsPlanted: ["hidden key"] });

    const flags = checkSetupPayoff(ir, plan, bible);
    expect(flags).toHaveLength(0);
  });
});

describe("checkDanglingSetups", () => {
  it("flags planted setups with no payoff across all IRs", () => {
    const bible = makeBibleWithSetup("scene-1", null); // planted, no payoff scene
    const allIRs = [makeVerifiedIR("scene-1"), makeVerifiedIR("scene-2")];
    const flags = checkDanglingSetups(allIRs, bible, "scene-2");

    expect(flags).toHaveLength(1);
    expect(flags[0]!.category).toBe("dangling_setup");
    expect(flags[0]!.severity).toBe("critical");
    expect(flags[0]!.message).toContain("hidden key");
  });

  it("no flags when all planted setups are paid off via IR", () => {
    const bible = makeBibleWithSetup("scene-1", null); // planted, no payoff scene registered
    // But the payoff WAS executed in some scene's IR
    const allIRs = [
      makeVerifiedIR("scene-1"),
      makeVerifiedIR("scene-2", { payoffsExecuted: ["the hidden key under the mat"] }),
    ];
    const flags = checkDanglingSetups(allIRs, bible, "scene-2");
    expect(flags).toHaveLength(0);
  });

  it("returns empty when no planted setups exist", () => {
    const bible = createEmptyBible("proj-1");
    const flags = checkDanglingSetups([], bible, "scene-1");
    expect(flags).toHaveLength(0);
  });
});
