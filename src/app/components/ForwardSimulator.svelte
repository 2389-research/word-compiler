<script lang="ts">
import type { NarrativeIR, ScenePlan } from "../../types/index.js";
import { Button, Pane } from "../primitives/index.js";

interface SceneNode {
  plan: ScenePlan;
  ir: NarrativeIR | null;
  sceneOrder: number;
}

let {
  scenes,
  activeSceneIndex,
  onSelectScene,
}: {
  scenes: SceneNode[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
} = $props();

interface ReaderStateDiff {
  newKnowledge: string[];
  newTensions: string[];
  resolvedTensions: string[];
}

function computeDiff(prevIR: NarrativeIR | null, currentIR: NarrativeIR): ReaderStateDiff {
  const prevTensions = new Set(prevIR?.unresolvedTensions ?? []);
  const currentTensions = new Set(currentIR.unresolvedTensions);
  return {
    newKnowledge: currentIR.factsRevealedToReader,
    newTensions: currentIR.unresolvedTensions.filter((t) => !prevTensions.has(t)),
    resolvedTensions: [...prevTensions].filter((t) => !currentTensions.has(t)),
  };
}
</script>

<Pane title={scenes.length === 0 ? "Forward Simulator" : "Forward Simulator — Reader State Trace"}>
  {#snippet headerRight()}
    {#if scenes.length > 0}
      <span class="fwd-note">Only verified IRs contribute to state diff.</span>
    {/if}
  {/snippet}

  {#if scenes.length === 0}
    <div class="fwd-empty">No scenes added yet.</div>
  {:else}
    <div class="fwd-timeline-wrapper">
      <div class="fwd-timeline">
        {#each scenes as node, i (node.plan.id)}
          {@const hasIR = node.ir !== null}
          {@const isVerified = node.ir?.verified ?? false}
          {@const diff = hasIR && isVerified ? computeDiff(i > 0 ? (scenes[i - 1]?.ir ?? null) : null, node.ir!) : null}
          <div class="fwd-node-wrapper">
            <Button variant="ghost" onclick={() => onSelectScene(i)}>
              <div class="fwd-node" class:fwd-node-active={i === activeSceneIndex}>
                <div class="fwd-scene-num">Scene {i + 1}</div>
                <div class="fwd-scene-title">{node.plan.title || "(untitled)"}</div>
                {#if !hasIR}
                  <div class="fwd-no-ir">No IR</div>
                {:else if !isVerified}
                  <div class="fwd-unverified">IR (unverified)</div>
                {/if}
                {#if diff}
                  <div class="fwd-diff">
                    {#if diff.newKnowledge.length > 0}
                      <div class="fwd-facts">+{diff.newKnowledge.length} fact{diff.newKnowledge.length !== 1 ? "s" : ""} revealed</div>
                    {/if}
                    {#if diff.newTensions.length > 0}
                      <div class="fwd-tensions">+{diff.newTensions.length} tension{diff.newTensions.length !== 1 ? "s" : ""}</div>
                    {/if}
                    {#if diff.resolvedTensions.length > 0}
                      <div class="fwd-resolved">-{diff.resolvedTensions.length} resolved</div>
                    {/if}
                  </div>
                {/if}
              </div>
            </Button>
            {#if i < scenes.length - 1}
              <div class="fwd-arrow">→</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</Pane>

<style>
  .fwd-note { font-size: 0.8em; opacity: 0.5; }
  .fwd-empty { padding: 24px; opacity: 0.5; text-align: center; }
  .fwd-timeline-wrapper { padding: 16px; overflow-x: auto; }
  .fwd-timeline { display: flex; gap: 12px; align-items: flex-start; }
  .fwd-node-wrapper { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .fwd-node {
    background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px 16px; min-width: 160px; max-width: 200px;
    text-align: left; color: inherit; font-family: inherit; font-size: inherit;
  }
  .fwd-node-active { border-color: var(--focus-color); background: var(--focus-bg); }
  .fwd-scene-num { font-size: 0.75em; opacity: 0.5; margin-bottom: 4px; }
  .fwd-scene-title { font-size: 0.9em; font-weight: 600; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fwd-no-ir { font-size: 0.75em; opacity: 0.4; }
  .fwd-unverified { font-size: 0.75em; opacity: 0.5; }
  .fwd-diff { font-size: 0.75em; }
  .fwd-facts { color: var(--status-ok); margin-bottom: 2px; }
  .fwd-tensions { color: var(--status-tension); margin-bottom: 2px; }
  .fwd-resolved { color: var(--status-resolved); margin-bottom: 2px; }
  .fwd-arrow { opacity: 0.3; font-size: 1.2em; }
</style>
