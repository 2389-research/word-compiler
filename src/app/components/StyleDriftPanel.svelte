<script lang="ts">
import type { StyleDriftReport } from "../../types/index.js";
import { Badge, Pane } from "../primitives/index.js";

let {
  reports,
  baselineSceneTitle,
  sceneTitles,
}: {
  reports: StyleDriftReport[];
  baselineSceneTitle: string;
  sceneTitles: Record<string, string>;
} = $props();

function sceneTitle(id: string): string {
  return sceneTitles[id] ?? id;
}

interface MetricRow {
  label: string;
  help: string;
  baseline: number;
  current: number;
  driftPct: number;
  flagged: boolean;
  unit: string;
  /** Higher current value means this direction */
  higherMeans: string;
  lowerMeans: string;
}

function getMetrics(report: StyleDriftReport): MetricRow[] {
  const b = report.baselineMetrics;
  const c = report.currentMetrics;
  return [
    {
      label: "Sentence length",
      help: "Average words per sentence",
      baseline: b.avgSentenceLength,
      current: c.avgSentenceLength,
      driftPct: report.driftPercent.avgSentenceLength,
      flagged: report.flaggedFields.includes("avgSentenceLength"),
      unit: "words",
      higherMeans: "longer sentences",
      lowerMeans: "shorter sentences",
    },
    {
      label: "Sentence rhythm",
      help: "How much sentence length varies — higher means more rhythmic variety",
      baseline: b.sentenceLengthStdDev,
      current: c.sentenceLengthStdDev,
      driftPct: report.driftPercent.sentenceLengthStdDev,
      flagged: report.flaggedFields.includes("sentenceLengthStdDev"),
      unit: "",
      higherMeans: "more varied rhythm",
      lowerMeans: "more monotonous rhythm",
    },
    {
      label: "Vocabulary range",
      help: "Ratio of unique words to total — higher means more diverse vocabulary",
      baseline: b.typeTokenRatio,
      current: c.typeTokenRatio,
      driftPct: report.driftPercent.typeTokenRatio,
      flagged: report.flaggedFields.includes("typeTokenRatio"),
      unit: "",
      higherMeans: "more varied vocabulary",
      lowerMeans: "more repetitive vocabulary",
    },
    {
      label: "Paragraph size",
      help: "Average sentences per paragraph",
      baseline: b.avgParagraphLength,
      current: c.avgParagraphLength,
      driftPct: report.driftPercent.avgParagraphLength,
      flagged: report.flaggedFields.includes("avgParagraphLength"),
      unit: "sentences",
      higherMeans: "longer paragraphs",
      lowerMeans: "shorter paragraphs",
    },
  ];
}

function formatVal(val: number, unit: string): string {
  const rounded = val < 1 ? val.toFixed(2) : val.toFixed(1);
  return unit ? `${rounded} ${unit}` : rounded;
}

function directionLabel(m: MetricRow): string {
  const pct = `${(m.driftPct * 100).toFixed(1)}%`;
  if (m.current > m.baseline) return `${pct} ${m.higherMeans}`;
  if (m.current < m.baseline) return `${pct} ${m.lowerMeans}`;
  return "no change";
}

let flaggedCount = $derived(reports.filter((r) => r.flagged).length);
</script>

<Pane title="Voice Consistency">
  {#snippet headerRight()}
    {#if reports.length > 0}
      <span class="drift-baseline">vs. {baselineSceneTitle}</span>
    {/if}
  {/snippet}

  {#if reports.length === 0}
    <div class="drift-empty">Complete at least 2 scenes to compare voice consistency between them.</div>
  {:else}
    <div class="drift-overview">
      {#if flaggedCount === 0}
        <Badge variant="accepted">Consistent</Badge>
        <span class="drift-overview-text">Voice is holding steady across all scenes.</span>
      {:else}
        <Badge variant="rejected">{flaggedCount} scene{flaggedCount > 1 ? "s" : ""} drifting</Badge>
        <span class="drift-overview-text">Compared to "{baselineSceneTitle}" (your first completed scene).</span>
      {/if}
    </div>

    <div class="drift-cards">
      {#each reports as report (report.currentSceneId)}
        {@const metrics = getMetrics(report)}
        <div class="drift-card" class:drift-card-flagged={report.flagged}>
          <div class="drift-card-header">
            <span class="drift-card-title">{sceneTitle(report.currentSceneId)}</span>
            {#if report.flagged}
              <Badge variant="rejected">Drifting</Badge>
            {:else}
              <Badge variant="accepted">Consistent</Badge>
            {/if}
          </div>

          <div class="drift-metrics">
            {#each metrics as m}
              <div class="drift-metric" class:drift-metric-flagged={m.flagged}>
                <div class="drift-metric-header">
                  <span class="drift-metric-label">{m.label}</span>
                  <span class="drift-metric-direction" class:drift-ok={!m.flagged} class:drift-warn={m.flagged}>
                    {directionLabel(m)}
                  </span>
                </div>
                <div class="drift-metric-values">
                  <span class="drift-metric-baseline">{formatVal(m.baseline, m.unit)}</span>
                  <span class="drift-metric-arrow">→</span>
                  <span class="drift-metric-current">{formatVal(m.current, m.unit)}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Pane>

<style>
  .drift-baseline { font-size: 10px; opacity: 0.5; }
  .drift-empty { padding: 24px; opacity: 0.5; text-align: center; font-size: 12px; }

  .drift-overview { display: flex; align-items: center; gap: 8px; padding: 8px 8px 4px; }
  .drift-overview-text { font-size: 11px; color: var(--text-secondary); }

  .drift-cards { display: flex; flex-direction: column; gap: 8px; padding: 8px; }

  .drift-card {
    border: 1px solid var(--border); border-radius: var(--radius-md);
    background: var(--bg-primary); overflow: hidden;
  }
  .drift-card-flagged { border-color: var(--warning); }

  .drift-card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px; border-bottom: 1px solid var(--border);
  }
  .drift-card-title { font-size: 12px; font-weight: 600; }

  .drift-metrics { padding: 6px 10px; }

  .drift-metric { padding: 4px 0; }
  .drift-metric + .drift-metric { border-top: 1px solid var(--border); }
  .drift-metric-flagged { }

  .drift-metric-header { display: flex; justify-content: space-between; align-items: baseline; }
  .drift-metric-label { font-size: 11px; color: var(--text-secondary); }
  .drift-metric-direction { font-size: 11px; font-weight: 500; }
  .drift-ok { color: var(--success); }
  .drift-warn { color: var(--warning); }

  .drift-metric-values { font-size: 10px; color: var(--text-muted); margin-top: 1px; }
  .drift-metric-baseline { }
  .drift-metric-arrow { margin: 0 4px; opacity: 0.4; }
  .drift-metric-current { }
</style>
