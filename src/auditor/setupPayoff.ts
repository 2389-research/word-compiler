import type { AuditFlag, Bible, NarrativeIR, ScenePlan } from "../types/index.js";
import { generateId } from "../types/index.js";

// ─── Setup/Payoff Registry ───────────────────────────────
//
// Compares what the scene PLAN said would be planted/paid off
// against what the IR says actually happened.

export function checkSetupPayoff(sceneIR: NarrativeIR, plan: ScenePlan, bible: Bible): AuditFlag[] {
  const flags: AuditFlag[] = [];

  // Check setups that are "planted" in this scene according to the bible
  const biblePlantedInThisScene = bible.narrativeRules.setups.filter(
    (s) => s.plantedInScene === plan.id && s.status === "planted",
  );

  for (const setup of biblePlantedInThisScene) {
    const wasPlanted = sceneIR.setupsPlanted.some(
      (planted) =>
        planted.toLowerCase().includes(setup.description.toLowerCase()) ||
        setup.description.toLowerCase().includes(planted.toLowerCase()),
    );
    if (!wasPlanted) {
      flags.push({
        id: generateId(),
        sceneId: sceneIR.sceneId,
        severity: "warning",
        category: "setup_missing",
        message: `Setup "${setup.description}" was registered as planted in this scene but not found in IR.setupsPlanted. Was it actually executed?`,
        lineReference: null,
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
    }
  }

  // Check payoffs that should have been executed in this scene
  const biblePaidOffInThisScene = bible.narrativeRules.setups.filter((s) => s.payoffInScene === plan.id);

  for (const setup of biblePaidOffInThisScene) {
    const wasExecuted = sceneIR.payoffsExecuted.some(
      (payoff) =>
        payoff.toLowerCase().includes(setup.description.toLowerCase()) ||
        setup.description.toLowerCase().includes(payoff.toLowerCase()),
    );
    if (!wasExecuted) {
      flags.push({
        id: generateId(),
        sceneId: sceneIR.sceneId,
        severity: "warning",
        category: "payoff_missing",
        message: `Payoff for "${setup.description}" was planned for this scene but not found in IR.payoffsExecuted. Dangling setup risk.`,
        lineReference: null,
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
    }
  }

  return flags;
}

// ─── Dangling Setup Detection ────────────────────────────
//
// At manuscript completion: checks that all "planted" setups have been paid off.

export function checkDanglingSetups(allIRs: NarrativeIR[], bible: Bible, finalSceneId: string): AuditFlag[] {
  const flags: AuditFlag[] = [];

  const allPayoffsExecuted = new Set<string>(allIRs.flatMap((ir) => ir.payoffsExecuted.map((p) => p.toLowerCase())));

  const danglingSetups = bible.narrativeRules.setups.filter((s) => s.status === "planted" && s.payoffInScene === null);

  for (const setup of danglingSetups) {
    const paidOff = [...allPayoffsExecuted].some(
      (payoff) => payoff.includes(setup.description.toLowerCase()) || setup.description.toLowerCase().includes(payoff),
    );
    if (!paidOff) {
      flags.push({
        id: generateId(),
        sceneId: finalSceneId,
        severity: "critical",
        category: "dangling_setup",
        message: `Setup "${setup.description}" was planted but has no payoff. Reader will feel cheated.`,
        lineReference: null,
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
    }
  }

  return flags;
}
