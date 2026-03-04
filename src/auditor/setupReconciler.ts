import type { Bible, NarrativeIR } from "../types/index.js";
import { findPayoffForSetup, matchesSetupDescription } from "./setupMatching.js";

// ─── Setup Status Reconciler ────────────────────────────
//
// Pure function: Bible + verified IRs → updated Bible with
// reconciled setup statuses. Closes the loop between
// LLM-extracted IR evidence and Bible setup entries.

export interface ReconciliationChange {
  setupId: string;
  description: string;
  from: string;
  to: string;
  sceneId: string;
  reason: string;
}

export interface ReconciliationResult {
  updatedBible: Bible;
  changes: ReconciliationChange[];
}

/**
 * Reconcile Bible setup statuses against verified IR evidence.
 *
 * Transitions:
 *   planned → planted  — when a trusted IR's setupsPlanted matches the description
 *   planted → paid-off — when a trusted IR's payoffsExecuted matches AND comes
 *                         chronologically after the planting scene
 *
 * Already paid-off or dangling entries are skipped.
 *
 * @param trustUnverifiedSceneIds — scene IDs whose IRs should be trusted
 *   even if not yet verified (e.g. the freshly-extracted IR).
 */
export function reconcileSetupStatuses(
  bible: Bible,
  sceneIRs: Record<string, NarrativeIR>,
  sceneOrders: Record<string, number>,
  trustUnverifiedSceneIds: string[] = [],
): ReconciliationResult {
  const changes: ReconciliationChange[] = [];
  const trustSet = new Set(trustUnverifiedSceneIds);

  // Collect trusted IRs sorted by scene order for deterministic results
  const trustedIRs = Object.entries(sceneIRs)
    .filter(([sceneId, ir]) => ir.verified || trustSet.has(sceneId))
    .sort(([a], [b]) => (sceneOrders[a] ?? 0) - (sceneOrders[b] ?? 0));

  // Pass 1: planned → planted
  const afterPlanting = bible.narrativeRules.setups.map((setup) => {
    if (setup.status !== "planned") return setup;

    for (const [sceneId, ir] of trustedIRs) {
      const match = ir.setupsPlanted.some((planted) => matchesSetupDescription(setup.description, planted));
      if (match) {
        changes.push({
          setupId: setup.id,
          description: setup.description,
          from: "planned",
          to: "planted",
          sceneId,
          reason: `IR for scene ${sceneId} contains matching setupsPlanted entry`,
        });
        return { ...setup, status: "planted" as const, plantedInScene: sceneId };
      }
    }
    return setup;
  });

  // Pass 2: planted → paid-off (uses pass 1 results, so newly-planted setups are eligible)
  const updatedSetups = afterPlanting.map((setup) => {
    if (setup.status !== "planted") return setup;

    const plantedOrder = sceneOrders[setup.plantedInScene ?? ""] ?? -1;

    for (const [sceneId, ir] of trustedIRs) {
      const payoffOrder = sceneOrders[sceneId] ?? 0;
      if (payoffOrder <= plantedOrder) continue;

      const matchingPayoff = findPayoffForSetup(setup.description, ir.payoffsExecuted);
      if (matchingPayoff) {
        changes.push({
          setupId: setup.id,
          description: setup.description,
          from: "planted",
          to: "paid-off",
          sceneId,
          reason: `IR for scene ${sceneId} contains matching payoffsExecuted: "${matchingPayoff}"`,
        });
        return { ...setup, status: "paid-off" as const, payoffInScene: sceneId };
      }
    }
    return setup;
  });

  const updatedBible: Bible = {
    ...bible,
    narrativeRules: {
      ...bible.narrativeRules,
      setups: updatedSetups,
    },
  };

  return { updatedBible, changes };
}
