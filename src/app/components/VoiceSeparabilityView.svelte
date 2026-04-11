<script lang="ts">
import type { VoiceSeparabilityReport } from "../../types/index.js";
import { Pane, Table } from "../primitives/index.js";

let {
  report,
}: {
  report: VoiceSeparabilityReport | null;
} = $props();
</script>

<Pane title="Voice Analysis">
  {#snippet headerRight()}
    {#if report}
      <span class="voice-status">
        {#if report.separable}
          <span class="voice-good">Voices distinguishable</span>
        {:else}
          <span class="voice-bad">Voices may be indistinguishable</span>
        {/if}
      </span>
    {/if}
  {/snippet}

  {#if !report}
    <div class="voice-empty">No voice separability data. Complete sections with writing to analyze.</div>
  {:else}
    <div class="voice-body">
      <p class="voice-detail">{report.detail}</p>
      <p class="voice-variance">
        Inter-character sentence length variance: <strong>{report.interCharacterVariance.toFixed(2)}</strong> words (threshold: 1.5)
      </p>

      {#if report.characterStats.length > 0}
        <Table>
          <thead>
            <tr>
              <th class="th-left">Voice</th>
              <th class="th-right">Writing Passages</th>
              <th class="th-right">Avg Sentence Len</th>
              <th class="th-right">Variance</th>
              <th class="th-right">TTR</th>
            </tr>
          </thead>
          <tbody>
            {#each report.characterStats as stat (stat.characterId)}
              <tr>
                <td>{stat.characterName}</td>
                <td class="td-mono">{stat.dialogueCount}</td>
                <td class="td-mono">{stat.avgSentenceLength.toFixed(1)}</td>
                <td class="td-mono">{stat.sentenceLengthStdDev.toFixed(1)}</td>
                <td class="td-mono">{stat.typeTokenRatio.toFixed(2)}</td>
              </tr>
            {/each}
          </tbody>
        </Table>
      {/if}
    </div>
  {/if}
</Pane>

<style>
  .voice-status { font-size: 0.85em; }
  .voice-good { color: var(--status-ok); }
  .voice-bad { color: var(--status-bad); }
  .voice-empty { padding: 24px; opacity: 0.5; text-align: center; }
  .voice-body { padding: 16px; }
  .voice-detail { font-size: 0.85em; opacity: 0.7; margin-top: 0; }
  .voice-variance { font-size: 0.85em; opacity: 0.5; }
  .th-left { text-align: left; }
  .th-right { text-align: right; }
  .td-mono { text-align: right; font-family: monospace; }
</style>
