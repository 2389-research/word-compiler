<script lang="ts">
import type { StyleDriftReport } from "../../types/index.js";
import { Pane, Table } from "../primitives/index.js";

let {
  reports,
  baselineSceneTitle,
}: {
  reports: StyleDriftReport[];
  baselineSceneTitle: string;
} = $props();

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
</script>

<Pane title={reports.length === 0 ? "Style Drift" : "Style Drift from Chapter 1 Baseline"}>
  {#snippet headerRight()}
    {#if reports.length > 0}
      <span class="drift-baseline">Baseline: {baselineSceneTitle}</span>
    {/if}
  {/snippet}

  {#if reports.length === 0}
    <div class="drift-empty">No drift data available. Complete multiple scenes with metrics to see drift.</div>
  {:else}
    <div class="drift-table-wrapper">
      <Table>
        <thead>
          <tr>
            <th class="th-left">Scene</th>
            <th class="th-right">Avg Sentence Len</th>
            <th class="th-right">Variance</th>
            <th class="th-right">TTR</th>
            <th class="th-right">Para Length</th>
            <th class="th-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each reports as report (report.currentSceneId)}
            <tr>
              <td class="scene-id">{report.currentSceneId.slice(0, 12)}…</td>
              <td class="drift-cell" class:flagged={report.flaggedFields.includes("avgSentenceLength")}>
                {pct(report.driftPercent.avgSentenceLength)} {report.flaggedFields.includes("avgSentenceLength") ? "⚠" : ""}
              </td>
              <td class="drift-cell" class:flagged={report.flaggedFields.includes("sentenceLengthVariance")}>
                {pct(report.driftPercent.sentenceLengthVariance)} {report.flaggedFields.includes("sentenceLengthVariance") ? "⚠" : ""}
              </td>
              <td class="drift-cell" class:flagged={report.flaggedFields.includes("typeTokenRatio")}>
                {pct(report.driftPercent.typeTokenRatio)} {report.flaggedFields.includes("typeTokenRatio") ? "⚠" : ""}
              </td>
              <td class="drift-cell" class:flagged={report.flaggedFields.includes("avgParagraphLength")}>
                {pct(report.driftPercent.avgParagraphLength)} {report.flaggedFields.includes("avgParagraphLength") ? "⚠" : ""}
              </td>
              <td class="status-cell">
                {#if report.flagged}
                  <span class="status-flagged">Flagged</span>
                {:else}
                  <span class="status-ok">OK</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
      <p class="drift-note">⚠ = drift &gt;10% from baseline. Style drift target: &lt;10% across all metrics.</p>
    </div>
  {/if}
</Pane>

<style>
  .drift-baseline { font-size: 0.8em; opacity: 0.5; }
  .drift-empty { padding: 24px; opacity: 0.5; text-align: center; }
  .drift-table-wrapper { padding: 16px; overflow-x: auto; }
  .th-left { text-align: left; }
  .th-right { text-align: right; }
  .th-center { text-align: center; }
  .scene-id { font-family: monospace; font-size: 0.8em; }
  .drift-cell { font-family: monospace; text-align: right; color: var(--status-ok); }
  .drift-cell.flagged { color: var(--status-bad); }
  .status-cell { text-align: center; }
  .status-flagged { color: var(--status-bad); }
  .status-ok { color: var(--status-ok); }
  .drift-note { font-size: 0.8em; opacity: 0.5; margin-top: 8px; }
</style>
