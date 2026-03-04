<script lang="ts">
import { matchesSetupDescription } from "../../auditor/setupMatching.js";
import type { NarrativeIR } from "../../types/index.js";
import { Badge, Pane } from "../primitives/index.js";

let {
  sceneIRs,
  sceneTitles,
  sceneOrders,
}: {
  sceneIRs: Record<string, NarrativeIR>;
  sceneTitles: Record<string, string>;
  sceneOrders: Record<string, number>;
} = $props();

interface SetupEntry {
  text: string;
  plantedInScene: string;
  paidOffInScene: string | null;
}

/** Collect all payoff texts with their scene IDs from verified IRs */
function collectPayoffs(irs: Record<string, NarrativeIR>): Array<{ text: string; sceneId: string }> {
  const payoffs: Array<{ text: string; sceneId: string }> = [];
  for (const [sceneId, ir] of Object.entries(irs)) {
    if (!ir.verified) continue;
    for (const payoff of ir.payoffsExecuted) {
      payoffs.push({ text: payoff, sceneId });
    }
  }
  return payoffs;
}

/** Find the earliest chronologically-valid payoff for a setup description. */
function findEarliestPayoff(
  setupText: string,
  setupOrder: number,
  payoffs: Array<{ text: string; sceneId: string }>,
  orders: Record<string, number>,
): string | null {
  let bestScene: string | null = null;
  let bestOrder = Infinity;
  for (const p of payoffs) {
    const pOrder = orders[p.sceneId];
    if (pOrder === undefined) continue;
    if (pOrder > setupOrder && pOrder < bestOrder && matchesSetupDescription(setupText, p.text)) {
      bestScene = p.sceneId;
      bestOrder = pOrder;
    }
  }
  return bestScene;
}

/** Match setups to their payoffs using fuzzy matching, respecting chronological order */
function matchSetupsToPayoffs(
  irs: Record<string, NarrativeIR>,
  orders: Record<string, number>,
  payoffs: Array<{ text: string; sceneId: string }>,
): SetupEntry[] {
  const setups: SetupEntry[] = [];
  for (const [sceneId, ir] of Object.entries(irs)) {
    if (!ir.verified) continue;
    for (const setup of ir.setupsPlanted) {
      const setupOrder = orders[sceneId];
      if (setupOrder === undefined) {
        setups.push({ text: setup, plantedInScene: sceneId, paidOffInScene: null });
        continue;
      }
      const paidOffInScene = findEarliestPayoff(setup, setupOrder, payoffs, orders);
      setups.push({ text: setup, plantedInScene: sceneId, paidOffInScene });
    }
  }
  return setups;
}

let entries = $derived.by((): SetupEntry[] => {
  const payoffs = collectPayoffs(sceneIRs);
  return matchSetupsToPayoffs(sceneIRs, sceneOrders, payoffs);
});

let resolved = $derived(entries.filter((e) => e.paidOffInScene !== null));
let dangling = $derived(entries.filter((e) => e.paidOffInScene === null));

function title(sceneId: string): string {
  return sceneTitles[sceneId] ?? sceneId;
}
</script>

<Pane title="Setups & Payoffs">
  {#if entries.length === 0}
    <div class="empty-state">No verified IRs with setups found. Extract and verify scene IRs to populate.</div>
  {:else}
    {#if dangling.length > 0}
      <div class="section">
        <div class="section-header">
          <Badge variant="warning">{dangling.length}</Badge>
          <span>Active Setups (unresolved)</span>
        </div>
        {#each dangling as entry}
          <div class="entry dangling">
            <span class="entry-text">{entry.text}</span>
            <span class="entry-meta">planted in {title(entry.plantedInScene)}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if resolved.length > 0}
      <div class="section">
        <div class="section-header">
          <Badge variant="accepted">{resolved.length}</Badge>
          <span>Resolved Payoffs</span>
        </div>
        {#each resolved as entry}
          <div class="entry resolved">
            <span class="entry-text">{entry.text}</span>
            <span class="entry-meta">
              {title(entry.plantedInScene)} &rarr; {title(entry.paidOffInScene!)}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</Pane>

<style>
  .empty-state { color: var(--text-muted); padding: 20px; text-align: center; font-size: 12px; }
  .section { margin-bottom: 12px; }
  .section-header {
    display: flex; align-items: center; gap: 6px; padding: 4px 8px;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--text-secondary); border-bottom: 1px solid var(--border);
  }
  .entry {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--border-dim, var(--border));
  }
  .entry-text { flex: 1; }
  .entry-meta { font-size: 10px; color: var(--text-muted); margin-left: 8px; white-space: nowrap; }
  .dangling .entry-text { color: var(--warning, #e8a838); }
  .resolved .entry-text { color: var(--text-primary); }
</style>
