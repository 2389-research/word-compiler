import { describe, expect, it } from "vitest";
import { reconcileSetupStatuses } from "../../src/auditor/setupReconciler.js";
import { type Bible, createEmptyBible, createEmptyNarrativeIR, type NarrativeIR } from "../../src/types/index.js";

function makeBible(
  setups: Array<{
    id: string;
    description: string;
    status: "planned" | "planted" | "paid-off" | "dangling";
    plantedInScene?: string | null;
    payoffInScene?: string | null;
  }>,
): Bible {
  const bible = createEmptyBible("proj-1");
  return {
    ...bible,
    narrativeRules: {
      ...bible.narrativeRules,
      setups: setups.map((s) => ({
        id: s.id,
        description: s.description,
        status: s.status,
        plantedInScene: s.plantedInScene ?? null,
        payoffInScene: s.payoffInScene ?? null,
      })),
    },
  };
}

function makeVerifiedIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return { ...createEmptyNarrativeIR(sceneId), verified: true, ...overrides };
}

describe("reconcileSetupStatuses", () => {
  it("transitions planned → planted when IR contains matching setupsPlanted", () => {
    const bible = makeBible([{ id: "s1", description: "The hidden key", status: "planned" }]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { setupsPlanted: ["The hidden key was placed under the mat"] }),
    };
    const orders = { "scene-1": 0 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("planted");
    expect(updatedBible.narrativeRules.setups[0]!.plantedInScene).toBe("scene-1");
    expect(changes).toHaveLength(1);
    expect(changes[0]!.from).toBe("planned");
    expect(changes[0]!.to).toBe("planted");
  });

  it("transitions planted → paid-off when IR contains matching payoffsExecuted", () => {
    const bible = makeBible([
      { id: "s1", description: "The hidden key", status: "planted", plantedInScene: "scene-1" },
    ]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1"),
      "scene-2": makeVerifiedIR("scene-2", {
        payoffsExecuted: ["The hidden key \u2014 Alice found it under the mat"],
      }),
    };
    const orders = { "scene-1": 0, "scene-2": 1 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("paid-off");
    expect(updatedBible.narrativeRules.setups[0]!.payoffInScene).toBe("scene-2");
    expect(changes).toHaveLength(1);
    expect(changes[0]!.from).toBe("planted");
    expect(changes[0]!.to).toBe("paid-off");
  });

  it("enforces chronological guard — payoff must come after planting", () => {
    const bible = makeBible([
      { id: "s1", description: "The hidden key", status: "planted", plantedInScene: "scene-2" },
    ]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { payoffsExecuted: ["The hidden key was used"] }),
      "scene-2": makeVerifiedIR("scene-2"),
    };
    const orders = { "scene-1": 0, "scene-2": 1 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    // scene-1 (order 0) comes before scene-2 (order 1), so payoff is rejected
    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("planted");
    expect(changes).toHaveLength(0);
  });

  it("ignores unverified IRs by default", () => {
    const bible = makeBible([{ id: "s1", description: "The hidden key", status: "planned" }]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": { ...createEmptyNarrativeIR("scene-1"), verified: false, setupsPlanted: ["The hidden key"] },
    };
    const orders = { "scene-1": 0 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("planned");
    expect(changes).toHaveLength(0);
  });

  it("trusts unverified IRs when scene ID is in trustUnverifiedSceneIds", () => {
    const bible = makeBible([{ id: "s1", description: "The hidden key", status: "planned" }]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": { ...createEmptyNarrativeIR("scene-1"), verified: false, setupsPlanted: ["The hidden key"] },
    };
    const orders = { "scene-1": 0 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders, ["scene-1"]);

    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("planted");
    expect(changes).toHaveLength(1);
  });

  it("does not mutate the input bible", () => {
    const bible = makeBible([{ id: "s1", description: "The hidden key", status: "planned" }]);
    const originalStatus = bible.narrativeRules.setups[0]!.status;
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { setupsPlanted: ["The hidden key"] }),
    };

    reconcileSetupStatuses(bible, irs, { "scene-1": 0 });

    expect(bible.narrativeRules.setups[0]!.status).toBe(originalStatus);
  });

  it("handles multiple setups with mixed statuses", () => {
    const bible = makeBible([
      { id: "s1", description: "The hidden key", status: "planned" },
      { id: "s2", description: "The locked drawer", status: "planted", plantedInScene: "scene-1" },
      { id: "s3", description: "The mysterious letter", status: "paid-off", payoffInScene: "scene-2" },
      { id: "s4", description: "The broken clock", status: "dangling" },
    ]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { setupsPlanted: ["The hidden key was placed"] }),
      "scene-2": makeVerifiedIR("scene-2", {
        payoffsExecuted: ["The locked drawer was opened"],
      }),
    };
    const orders = { "scene-1": 0, "scene-2": 1 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    // s1: planned → planted
    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("planted");
    // s2: planted → paid-off
    expect(updatedBible.narrativeRules.setups[1]!.status).toBe("paid-off");
    // s3: already paid-off → unchanged
    expect(updatedBible.narrativeRules.setups[2]!.status).toBe("paid-off");
    // s4: already dangling → unchanged
    expect(updatedBible.narrativeRules.setups[3]!.status).toBe("dangling");

    expect(changes).toHaveLength(2);
  });

  it("returns empty changes when nothing to reconcile", () => {
    const bible = makeBible([
      { id: "s1", description: "The hidden key", status: "paid-off", payoffInScene: "scene-2" },
    ]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1"),
    };

    const { changes } = reconcileSetupStatuses(bible, irs, { "scene-1": 0 });

    expect(changes).toHaveLength(0);
  });

  it("chains planned → planted → paid-off in a single reconciliation", () => {
    const bible = makeBible([{ id: "s1", description: "The hidden key", status: "planned" }]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { setupsPlanted: ["The hidden key was placed under the mat"] }),
      "scene-2": makeVerifiedIR("scene-2", {
        payoffsExecuted: ["The hidden key \u2014 Alice used it to unlock the vault"],
      }),
    };
    const orders = { "scene-1": 0, "scene-2": 1 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("paid-off");
    expect(updatedBible.narrativeRules.setups[0]!.plantedInScene).toBe("scene-1");
    expect(updatedBible.narrativeRules.setups[0]!.payoffInScene).toBe("scene-2");
    expect(changes).toHaveLength(2);
    expect(changes[0]!.to).toBe("planted");
    expect(changes[1]!.to).toBe("paid-off");
  });

  it("returns empty changes with empty bible setups", () => {
    const bible = createEmptyBible("proj-1");
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { setupsPlanted: ["something"] }),
    };

    const { changes } = reconcileSetupStatuses(bible, irs, { "scene-1": 0 });

    expect(changes).toHaveLength(0);
  });

  it("payoff at same scene order as planting is rejected", () => {
    const bible = makeBible([
      { id: "s1", description: "The hidden key", status: "planted", plantedInScene: "scene-1" },
    ]);
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeVerifiedIR("scene-1", { payoffsExecuted: ["The hidden key was used"] }),
    };
    const orders = { "scene-1": 0 };

    const { updatedBible, changes } = reconcileSetupStatuses(bible, irs, orders);

    expect(updatedBible.narrativeRules.setups[0]!.status).toBe("planted");
    expect(changes).toHaveLength(0);
  });
});
