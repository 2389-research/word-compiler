<script lang="ts">
import type { EditPattern } from "../../learner/diff.js";
import { accumulatePatterns, mapToProposedAction, type PatternGroup } from "../../learner/patterns.js";
import { type BibleProposal, generateProposals } from "../../learner/proposals.js";
import type { TuningProposal } from "../../learner/tuning.js";
import { Badge, Button, CollapsibleSection, Pane, ProgressBar } from "../primitives/index.js";

let {
  editPatterns,
  sceneOrder,
  projectId,
  tuningProposals = [],
  onAcceptProposal,
  onRejectProposal,
  onAcceptTuning,
  onRejectTuning,
}: {
  editPatterns: EditPattern[];
  sceneOrder: Map<string, number>;
  projectId: string;
  tuningProposals?: TuningProposal[];
  onAcceptProposal?: (proposal: BibleProposal) => void;
  onRejectProposal?: (proposal: BibleProposal) => void;
  onAcceptTuning?: (proposal: TuningProposal) => void;
  onRejectTuning?: (proposal: TuningProposal) => void;
} = $props();

let promoted = $derived(accumulatePatterns(editPatterns, sceneOrder));
let proposals = $derived(generateProposals(promoted, projectId));

// Track local accept/reject state
let decisions = $state<Record<string, "accepted" | "rejected">>({});

function handleAccept(proposal: BibleProposal) {
  decisions[proposal.id] = "accepted";
  onAcceptProposal?.(proposal);
}

function handleReject(proposal: BibleProposal) {
  decisions[proposal.id] = "rejected";
  onRejectProposal?.(proposal);
}

// Track tuning decisions
let tuningDecisions = $state<Record<string, "accepted" | "rejected">>({});

function handleAcceptTuning(proposal: TuningProposal) {
  tuningDecisions[proposal.id] = "accepted";
  onAcceptTuning?.(proposal);
}

function handleRejectTuning(proposal: TuningProposal) {
  tuningDecisions[proposal.id] = "rejected";
  onRejectTuning?.(proposal);
}

function formatConfidence(c: number): string {
  return `${Math.round(c * 100)}%`;
}

function formatAction(proposal: BibleProposal): string {
  switch (proposal.action.section) {
    case "killList":
      return `Add "${proposal.action.value}" to avoid list`;
    case "characters":
      return `Update author voice notes`;
    case "styleGuide":
      return `Update style guide`;
    case "locations":
      return `Update reference context`;
    default:
      return proposal.action.value;
  }
}
</script>

<Pane title="Learner Suggestions">
  {#snippet headerRight()}
    {#if proposals.length > 0}
      <Badge variant="info">{proposals.length} suggestion{proposals.length > 1 ? "s" : ""}</Badge>
    {/if}
  {/snippet}

  {#if editPatterns.length === 0}
    <div class="learner-empty">
      No edit patterns yet. Edit generated text to start building your writing profile.
    </div>
  {:else if proposals.length === 0}
    <div class="learner-empty">
      {editPatterns.length} edit{editPatterns.length > 1 ? "s" : ""} analyzed. Not enough consistent patterns yet to suggest changes.
    </div>
  {:else}
    <div class="learner-proposals">
      {#each proposals as proposal (proposal.id)}
        {@const decision = decisions[proposal.id]}
        <div class="proposal" class:proposal-accepted={decision === "accepted"} class:proposal-rejected={decision === "rejected"}>
          <div class="proposal-header">
            <span class="proposal-title">{proposal.title}</span>
            <span class="proposal-confidence">{formatConfidence(proposal.evidence.confidence)}</span>
          </div>

          <div class="proposal-meta">
            {proposal.description}
          </div>

          <div class="proposal-action">
            {formatAction(proposal)}
          </div>

          <ProgressBar value={proposal.evidence.confidence} max={1} />

          {#if proposal.evidence.examples.length > 0}
            <CollapsibleSection summary="Examples ({proposal.evidence.examples.length})">
              <div class="proposal-examples">
                {#each proposal.evidence.examples as ex}
                  <div class="example">
                    {#if ex.original}
                      <div class="example-before">{ex.original}</div>
                    {/if}
                    {#if ex.edited}
                      <div class="example-after">{ex.edited}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </CollapsibleSection>
          {/if}

          {#if proposal.action.section === "compilationNotes"}
            <div class="proposal-decision">Insight</div>
          {:else if !decision}
            <div class="proposal-actions">
              <Button onclick={() => handleAccept(proposal)} title="Apply this suggestion to your brief">Accept</Button>
              <Button onclick={() => handleReject(proposal)} title="Dismiss this suggestion">Reject</Button>
            </div>
          {:else}
            <div class="proposal-decision">
              {decision === "accepted" ? "Applied" : "Dismissed"}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Pane>

{#if tuningProposals.length > 0}
  <Pane title="Tuning Suggestions">
    {#snippet headerRight()}
      <Badge variant="info">{tuningProposals.length}</Badge>
    {/snippet}

    <div class="tuning-proposals">
      {#each tuningProposals as tp (tp.id)}
        {@const decision = tuningDecisions[tp.id]}
        <div class="proposal" class:proposal-accepted={decision === "accepted"} class:proposal-rejected={decision === "rejected"}>
          <div class="proposal-header">
            <span class="proposal-title">{tp.parameter}</span>
            <span class="proposal-confidence">{Math.round(tp.confidence * 100)}%</span>
          </div>
          <div class="tuning-values">
            <span class="tuning-current">{tp.currentValue}</span>
            <span class="tuning-arrow">&rarr;</span>
            <span class="tuning-suggested">{tp.suggestedValue}</span>
          </div>
          <div class="proposal-meta">{tp.rationale}</div>
          <ProgressBar value={tp.confidence} max={1} />
          {#if !decision}
            <div class="proposal-actions">
              <Button onclick={() => handleAcceptTuning(tp)} title="Apply this tuning suggestion">Accept</Button>
              <Button onclick={() => handleRejectTuning(tp)} title="Dismiss this suggestion">Reject</Button>
            </div>
          {:else}
            <div class="proposal-decision">
              {decision === "accepted" ? "Applied" : "Dismissed"}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </Pane>
{/if}

<style>
  .learner-empty { color: var(--text-muted); padding: 20px; text-align: center; font-size: 12px; }
  .learner-proposals { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
  .proposal {
    background: var(--bg-primary); border: 1px solid var(--border);
    border-radius: var(--radius-md); padding: 10px 12px;
  }
  .proposal-accepted { border-color: var(--success, #4caf50); opacity: 0.7; }
  .proposal-rejected { border-color: var(--text-muted); opacity: 0.5; }
  .proposal-header { display: flex; justify-content: space-between; align-items: baseline; }
  .proposal-title { font-size: 13px; font-weight: 600; }
  .proposal-confidence { font-size: 11px; color: var(--accent); font-weight: 600; }
  .proposal-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .proposal-action {
    font-size: 11px; color: var(--text-secondary); margin-top: 6px;
    padding: 4px 8px; background: var(--bg-secondary, var(--bg-primary));
    border-radius: var(--radius-sm); font-family: monospace;
  }
  .proposal-examples { display: flex; flex-direction: column; gap: 6px; }
  .example { font-size: 11px; padding: 4px 0; border-bottom: 1px solid var(--border); }
  .example-before { color: var(--error, #e85050); text-decoration: line-through; }
  .example-after { color: var(--success, #4caf50); }
  .proposal-actions { display: flex; gap: 8px; margin-top: 8px; }
  .proposal-decision {
    font-size: 11px; color: var(--text-muted); margin-top: 8px;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .tuning-proposals { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
  .tuning-values {
    display: flex; align-items: center; gap: 8px; font-size: 13px;
    font-family: var(--font-mono); margin-top: 4px; padding: 4px 8px;
    background: var(--bg-secondary, var(--bg-primary)); border-radius: var(--radius-sm);
  }
  .tuning-current { color: var(--text-muted); }
  .tuning-arrow { color: var(--text-secondary); }
  .tuning-suggested { color: var(--accent); font-weight: 600; }
</style>
