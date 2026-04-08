<script lang="ts">
import type { CharacterDelta, NarrativeIR } from "../../types/index.js";
import { Badge, Button, Pane, Spinner } from "../primitives/index.js";

let {
  ir,
  sceneTitle,
  isExtracting,
  canExtract,
  onExtract,
  onVerify,
  onUpdate,
  onClose,
}: {
  ir: NarrativeIR | null;
  sceneTitle: string;
  isExtracting: boolean;
  canExtract: boolean;
  onExtract: () => void;
  onVerify: () => void;
  onUpdate: (ir: NarrativeIR) => void;
  onClose: () => void;
} = $props();

function hasDeltaData(delta: CharacterDelta): boolean {
  return !!(delta.learned || delta.suspicionGained || delta.emotionalShift || delta.relationshipChange);
}
</script>

<Pane title="Section Blueprint — {sceneTitle}" extraClass="ir-inspector">
  {#snippet headerRight()}
    <div class="pane-actions">
      {#if !ir}
        <Badge>No IR</Badge>
      {:else if ir.verified}
        <Badge variant="accepted">Verified</Badge>
      {:else}
        <Badge variant="warning">Unverified</Badge>
      {/if}
      <Button onclick={onExtract} disabled={!canExtract || isExtracting}>
        {#if isExtracting}<Spinner size="sm" /> Extracting...{:else if ir}Re-extract{:else}Extract Blueprint{/if}
      </Button>
      {#if ir && !ir.verified}
        <Button variant="primary" onclick={onVerify}>Verify</Button>
      {/if}
      <Button onclick={onClose}>✕</Button>
    </div>
  {/snippet}

  {#if isExtracting}
    <div class="ir-extracting">
      <Spinner />
      <div>Extracting scene blueprint from prose...</div>
      <div class="ir-extracting-hint">This sends the full scene text to the LLM for analysis. Usually takes 10–30 seconds.</div>
    </div>
  {:else if !ir}
    <div class="ir-empty">No blueprint extracted yet. Complete the scene and click "Extract Blueprint" to analyze.</div>
  {:else}
    <div class="ir-body">
      <section>
        <h4 class="ir-heading">Events ({ir.events.length})</h4>
        {#if ir.events.length === 0}
          <p class="ir-none">None recorded</p>
        {:else}
          <ul class="ir-list">{#each ir.events as e, i}<li>{e}</li>{/each}</ul>
        {/if}
      </section>

      <section class="ir-section">
        <h4 class="ir-heading">
          Facts Introduced ({ir.factsIntroduced.length}) •
          <span class="ir-subheading">Revealed to Reader: {ir.factsRevealedToReader.length}</span>
        </h4>
        {#if ir.factsIntroduced.length === 0}
          <p class="ir-none">None</p>
        {:else}
          <ul class="ir-list">{#each ir.factsIntroduced as f, i}<li>{f}</li>{/each}</ul>
        {/if}
      </section>

      <section class="ir-section">
        <h4 class="ir-heading">Character Deltas ({ir.characterDeltas.length})</h4>
        {#if ir.characterDeltas.length === 0}
          <p class="ir-none">No character changes recorded</p>
        {:else}
          {#each ir.characterDeltas as delta, i}
            {#if hasDeltaData(delta)}
              <div class="delta-card">
                <strong class="delta-char">{delta.characterId}</strong>
                {#if delta.learned}<div class="delta-field"><span class="delta-label">LEARNED: </span>{delta.learned}</div>{/if}
                {#if delta.suspicionGained}<div class="delta-field"><span class="delta-label">SUSPECTS: </span>{delta.suspicionGained}</div>{/if}
                {#if delta.emotionalShift}<div class="delta-field"><span class="delta-label">EMOTIONAL: </span>{delta.emotionalShift}</div>{/if}
                {#if delta.relationshipChange}<div class="delta-field"><span class="delta-label">RELATIONSHIP: </span>{delta.relationshipChange}</div>{/if}
              </div>
            {/if}
          {/each}
        {/if}
      </section>

      <section class="ir-section">
        <h4 class="ir-heading">
          Setups Planted <Badge variant={ir.setupsPlanted.length > 0 ? "accepted" : "default"}>{ir.setupsPlanted.length}</Badge>
          {" • "}Payoffs Executed <Badge variant={ir.payoffsExecuted.length > 0 ? "accepted" : "default"}>{ir.payoffsExecuted.length}</Badge>
        </h4>
        {#each ir.setupsPlanted as s, i}<div class="setup-item">↑ {s}</div>{/each}
        {#each ir.payoffsExecuted as p, i}<div class="setup-item">✓ {p}</div>{/each}
      </section>

      {#if ir.unresolvedTensions.length > 0}
        <section class="ir-section">
          <h4 class="ir-heading">Unresolved Tensions ({ir.unresolvedTensions.length})</h4>
          <ul class="ir-list">{#each ir.unresolvedTensions as t, i}<li>{t}</li>{/each}</ul>
        </section>
      {/if}

      {#if ir.factsWithheld.length > 0}
        <section class="ir-section">
          <h4 class="ir-heading">Facts Withheld from Reader ({ir.factsWithheld.length})</h4>
          <ul class="ir-list withheld">{#each ir.factsWithheld as f, i}<li>{f}</li>{/each}</ul>
        </section>
      {/if}
    </div>
  {/if}
</Pane>

<style>
  :global(.ir-inspector) { max-height: 80vh; overflow-y: auto; }
  .ir-extracting { padding: 32px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--accent); }
  .ir-extracting-hint { font-size: 11px; color: var(--text-muted); }
  .ir-empty { padding: 24px; opacity: 0.6; text-align: center; }
  .ir-body { padding: 16px; }
  .ir-heading { margin: 0 0 8px; opacity: 0.7; }
  .ir-subheading { opacity: 0.5; }
  .ir-none { opacity: 0.4; }
  .ir-list { margin: 0; padding-left: 20px; }
  .ir-section { margin-top: 16px; }
  .delta-card { border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: 8px; }
  .delta-char { font-size: 0.85em; opacity: 0.7; }
  .delta-field { margin-top: 4px; }
  .delta-label { opacity: 0.6; font-size: 0.8em; }
  .setup-item { font-size: 0.9em; }
  .withheld li { opacity: 0.6; }
</style>
