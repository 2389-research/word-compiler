<script lang="ts">
import { accumulateReaderState, detectEpistemicIssues, type SceneInput } from "../../simulator/readerState.js";
import type { Bible, NarrativeIR, ScenePlan } from "../../types/index.js";
import { Badge, CollapsibleSection, DiagnosticItem, Pane } from "../primitives/index.js";

interface SceneNode {
  plan: ScenePlan;
  ir: NarrativeIR | null;
  sceneOrder: number;
}

let {
  scenes,
  activeSceneIndex,
  bible,
  onSelectScene,
}: {
  scenes: SceneNode[];
  activeSceneIndex: number;
  bible: Bible | null;
  onSelectScene: (index: number) => void;
} = $props();

let sceneInputs = $derived<SceneInput[]>(scenes.map((s) => ({ plan: s.plan, ir: s.ir, sceneOrder: s.sceneOrder })));
let sceneLookup = $derived(new Map(scenes.map((s, idx) => [s.plan.id, { scene: s, index: idx }])));
let readerStates = $derived(accumulateReaderState(sceneInputs));
let warnings = $derived(detectEpistemicIssues(sceneInputs, readerStates, bible ?? undefined));
let warningsByScene = $derived(
  warnings.reduce<Record<string, typeof warnings>>((acc, w) => {
    if (!acc[w.sceneId]) acc[w.sceneId] = [];
    acc[w.sceneId].push(w);
    return acc;
  }, {}),
);
</script>

<Pane title={scenes.length === 0 ? "Reader Journey" : "Reader State Trace"}>
  {#snippet headerRight()}
    {#if scenes.length > 0}
      <div class="fwd-header-info">
        {#if warnings.length > 0}
          <Badge variant="warning">{warnings.length} issue{warnings.length > 1 ? "s" : ""}</Badge>
        {/if}
        <span class="fwd-note">Only verified IRs contribute to state.</span>
      </div>
    {/if}
  {/snippet}

  {#if scenes.length === 0}
    <div class="fwd-empty">No sections added yet.</div>
  {:else}
    <div class="fwd-timeline">
      {#each readerStates as rs, i (rs.sceneId)}
        {@const entry = sceneLookup.get(rs.sceneId)}
        {@const scene = entry?.scene}
        {@const hasIR = scene?.ir !== null && scene?.ir !== undefined}
        {@const isVerified = scene?.ir?.verified ?? false}
        {@const sceneWarnings = warningsByScene[rs.sceneId] ?? []}

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fwd-node" class:fwd-node-active={entry?.index === activeSceneIndex} onclick={() => { if (entry) onSelectScene(entry.index); }}>
          <div class="fwd-node-header">
            <span class="fwd-scene-num">Section {i + 1}</span>
            <span class="fwd-scene-title">{scene?.plan.title || "(untitled)"}</span>
            {#if !hasIR}
              <span class="fwd-tag fwd-tag-empty">No IR</span>
            {:else if !isVerified}
              <span class="fwd-tag fwd-tag-unverified">Unverified</span>
            {:else}
              <span class="fwd-tag fwd-tag-verified">Verified</span>
            {/if}
            {#if sceneWarnings.length > 0}
              <Badge variant="warning">{sceneWarnings.length}</Badge>
            {/if}
          </div>

          <!-- Epistemic warnings for this scene -->
          {#if sceneWarnings.length > 0}
            <div class="fwd-warnings">
              {#each sceneWarnings as warning}
                <DiagnosticItem severity="warning" message={warning.message} />
              {/each}
            </div>
          {/if}

          <!-- Scene diff summary -->
          {#if rs.newFacts.length > 0 || rs.newTensions.length > 0 || rs.resolvedTensions.length > 0}
            <div class="fwd-diff-summary">
              {#if rs.newFacts.length > 0}
                <span class="fwd-facts">+{rs.newFacts.length} facts</span>
              {/if}
              {#if rs.newTensions.length > 0}
                <span class="fwd-tensions">+{rs.newTensions.length} tensions</span>
              {/if}
              {#if rs.resolvedTensions.length > 0}
                <span class="fwd-resolved">{rs.resolvedTensions.length} resolved</span>
              {/if}
            </div>
          {/if}

          <!-- Cumulative reader state -->
          {#if rs.state.knownFacts.size > 0}
            <CollapsibleSection summary="Reader knows ({rs.state.knownFacts.size})">
              <ul class="fwd-list fwd-list-facts">
                {#each [...rs.state.knownFacts] as fact}
                  <li>{#if rs.newFacts.includes(fact)}<strong>{fact}</strong>{:else}{fact}{/if}</li>
                {/each}
              </ul>
            </CollapsibleSection>
          {/if}

          {#if rs.state.suspicions.size > 0}
            <CollapsibleSection summary="Reader suspects ({rs.state.suspicions.size})">
              <ul class="fwd-list fwd-list-suspicions">
                {#each [...rs.state.suspicions] as suspicion}
                  <li>{suspicion}</li>
                {/each}
              </ul>
            </CollapsibleSection>
          {/if}

          {#if rs.state.unresolvedTensions.size > 0}
            <CollapsibleSection summary="Active tensions ({rs.state.unresolvedTensions.size})">
              <ul class="fwd-list fwd-list-tensions">
                {#each [...rs.state.unresolvedTensions] as tension}
                  <li>{#if rs.newTensions.includes(tension)}<strong>{tension}</strong>{:else}{tension}{/if}</li>
                {/each}
              </ul>
            </CollapsibleSection>
          {/if}

          {#if rs.state.wrongBeliefs.size > 0}
            <CollapsibleSection summary="Reader wrong about ({rs.state.wrongBeliefs.size})">
              <ul class="fwd-list fwd-list-wrong">
                {#each [...rs.state.wrongBeliefs] as belief}
                  <li>{belief}</li>
                {/each}
              </ul>
            </CollapsibleSection>
          {/if}

          {#if rs.resolvedTensions.length > 0}
            <CollapsibleSection summary="Resolved this section ({rs.resolvedTensions.length})">
              <ul class="fwd-list fwd-list-resolved">
                {#each rs.resolvedTensions as tension}
                  <li>{tension}</li>
                {/each}
              </ul>
            </CollapsibleSection>
          {/if}
        </div>

        {#if i < readerStates.length - 1}
          <div class="fwd-connector">↓</div>
        {/if}
      {/each}
    </div>
  {/if}
</Pane>

<style>
  .fwd-header-info { display: flex; align-items: center; gap: 8px; }
  .fwd-note { font-size: 0.8em; opacity: 0.5; }
  .fwd-empty { padding: 24px; opacity: 0.5; text-align: center; }
  .fwd-timeline { display: flex; flex-direction: column; gap: 0; padding: 8px; }
  .fwd-node {
    background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 10px 12px; cursor: pointer;
  }
  .fwd-node:hover { border-color: var(--text-muted); }
  .fwd-node-active { border-color: var(--accent); background: var(--focus-bg); }
  .fwd-node-header { display: flex; align-items: center; gap: 8px; }
  .fwd-scene-num { font-size: 10px; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
  .fwd-scene-title { font-size: 12px; font-weight: 600; flex: 1; }
  .fwd-tag { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: var(--radius-sm); }
  .fwd-tag-empty { color: var(--text-muted); border: 1px solid var(--border); }
  .fwd-tag-unverified { color: var(--warning); border: 1px solid var(--warning); }
  .fwd-tag-verified { color: var(--success); border: 1px solid var(--success); }
  .fwd-warnings { margin-top: 6px; }
  .fwd-diff-summary { display: flex; gap: 10px; margin-top: 6px; font-size: 11px; }
  .fwd-facts { color: var(--success); }
  .fwd-tensions { color: var(--warning); }
  .fwd-resolved { color: var(--text-muted); text-decoration: line-through; }
  .fwd-list { margin: 0; padding: 0 0 0 16px; font-size: 11px; line-height: 1.5; }
  .fwd-list-facts { color: var(--success); }
  .fwd-list-suspicions { color: var(--accent); }
  .fwd-list-tensions { color: var(--warning); }
  .fwd-list-wrong { color: var(--error, #e85050); }
  .fwd-list-resolved { color: var(--text-muted); }
  .fwd-connector { text-align: center; opacity: 0.2; font-size: 14px; line-height: 1; padding: 2px 0; }
</style>
