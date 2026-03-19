<script lang="ts">
import type { AuditFlag, CompilationLog, CompiledPayload, LintResult, ProseMetrics } from "../../types/index.js";
import { DiagnosticItem, MetricCard, Pane, ProgressBar, SectionPanel, SegmentedBar } from "../primitives/index.js";
import AuditPanel from "./AuditPanel.svelte";

let {
  payload,
  log,
  lintResult,
  auditFlags,
  metrics,
  onResolveFlag,
  onDismissFlag,
}: {
  payload: CompiledPayload | null;
  log: CompilationLog | null;
  lintResult: LintResult | null;
  auditFlags: AuditFlag[];
  metrics: ProseMetrics | null;
  onResolveFlag: (flagId: string, action: string) => void;
  onDismissFlag: (flagId: string) => void;
} = $props();

let r2Tokens = $derived(log?.ring2Tokens ?? 0);
let total = $derived(log ? log.ring1Tokens + r2Tokens + log.ring3Tokens : 0);
let r1Pct = $derived(total > 0 && log ? Math.max(Math.round((log.ring1Tokens / total) * 100), 1) : 0);
let r2Pct = $derived(total > 0 ? Math.max(Math.round((r2Tokens / total) * 100), 1) : 0);
let r3Pct = $derived(total > 0 && log ? Math.max(Math.round((log.ring3Tokens / total) * 100), 1) : 0);
let usedPct = $derived(total > 0 && log ? Math.max(1, Math.round((total / log.availableBudget) * 100)) : 0);
let lintErrors = $derived(lintResult?.issues.filter((i) => i.severity === "error") ?? []);
let lintWarnings = $derived(lintResult?.issues.filter((i) => i.severity === "warning") ?? []);
let lintInfos = $derived(lintResult?.issues.filter((i) => i.severity === "info") ?? []);

// Derive per-ring flag states from lint codes for visual indicators
let lintCodes = $derived(new Set(lintResult?.issues.map((i) => i.code) ?? []));
let r1Flagged = $derived(lintCodes.has("R1_OVER_CAP"));
let r2Flagged = $derived(lintCodes.has("R2_OVER_CAP"));
let r3Flagged = $derived(lintCodes.has("R3_STARVED"));
let overBudget = $derived(lintCodes.has("TOTAL_OVER_BUDGET"));
</script>

<Pane title="Draft Engine">
  {#snippet headerRight()}
    {#if log}
      <span class="header-tokens">{total.toLocaleString()} / {log.availableBudget.toLocaleString()} tokens</span>
    {/if}
  {/snippet}
    {#if !payload || !log}
      <div class="empty-state">Load a Bible and Scene Plan to see the compiled payload.</div>
    {:else}
      <!-- Budget Gauge -->
      <ProgressBar
        value={usedPct}
        variant={overBudget ? "error" : "default"}
        label="{usedPct}% of budget ({total.toLocaleString()} / {log.availableBudget.toLocaleString()} tokens)"
        showOverflow={overBudget}
        overflowPct={usedPct - 100}
      />

      <!-- Ring Breakdown -->
      <SegmentedBar segments={[
        ...(log.ring1Tokens > 0 ? [{ label: `R1 ${log.ring1Tokens.toLocaleString()}`, flex: r1Pct, variant: "r1", flagged: r1Flagged }] : []),
        ...(r2Tokens > 0 ? [{ label: `R2 ${r2Tokens.toLocaleString()}`, flex: r2Pct, variant: "r2", flagged: r2Flagged }] : []),
        ...(log.ring3Tokens > 0 ? [{ label: `R3 ${log.ring3Tokens.toLocaleString()}`, flex: r3Pct, variant: "r3", starved: r3Flagged }] : []),
      ]} />

      <!-- System Message -->
      <SectionPanel title="System Message (Ring 1)">
        {#snippet badge()}<span>{log.ring1Tokens} tokens</span>{/snippet}
        <div class="compiler-text">{payload.systemMessage}</div>
      </SectionPanel>

      <!-- User Message -->
      <SectionPanel title="User Message{r2Tokens > 0 ? ' (Ring 2 + Ring 3)' : ' (Ring 3)'}">
        {#snippet badge()}<span>{r2Tokens + log.ring3Tokens} tokens</span>{/snippet}
        <div class="compiler-text">{payload.userMessage}</div>
      </SectionPanel>

      <!-- Sections Included -->
      <SectionPanel title="Sections Included">
        <div class="sections-list">
          <strong>R1:</strong> {log.ring1Contents.join(", ") || "none"}<br />
          {#if log.ring2Contents.length > 0}<strong>R2:</strong> {log.ring2Contents.join(", ")}<br />{/if}
          <strong>R3:</strong> {log.ring3Contents.join(", ") || "none"}
        </div>
      </SectionPanel>

      <!-- Lint Results -->
      <SectionPanel title="Lint">
        {#snippet badge()}<span>{lintErrors.length}E {lintWarnings.length}W {lintInfos.length}I</span>{/snippet}
        {#each lintErrors as issue, i}
          <DiagnosticItem severity="error" code={issue.code} message={issue.message} />
        {/each}
        {#each lintWarnings as issue, i}
          <DiagnosticItem severity="warning" code={issue.code} message={issue.message} />
        {/each}
        {#each lintInfos as issue, i}
          <DiagnosticItem severity="info" code={issue.code} message={issue.message} />
        {/each}
        {#if lintResult?.issues.length === 0}
          <div class="lint-pass">All checks passed</div>
        {/if}
      </SectionPanel>

      <!-- Audit Panel -->
      <AuditPanel flags={auditFlags} onResolve={onResolveFlag} onDismiss={onDismissFlag} />

      <!-- Metrics -->
      {#if metrics}
        <SectionPanel title="Prose Metrics">
          <div class="metrics-grid">
            <MetricCard label="Words" value={metrics.wordCount} />
            <MetricCard label="Sentences" value={metrics.sentenceCount} />
            <MetricCard label="Avg Sentence" value="{metrics.avgSentenceLength.toFixed(1)}w" />
            <MetricCard label="Variance" value={metrics.sentenceLengthStdDev.toFixed(1)} valueColor={metrics.sentenceLengthStdDev >= 3 ? "var(--success)" : "var(--warning)"} />
            <MetricCard label="TTR" value={metrics.typeTokenRatio.toFixed(2)} />
            <MetricCard label="Paragraphs" value={metrics.paragraphCount} />
          </div>
        </SectionPanel>
      {/if}

      <!-- Gen Params -->
      <SectionPanel title="Generation Parameters">
        <div class="gen-params">Model: {payload.model} | Temp: {payload.temperature} | Top-P: {payload.topP} | Max: {payload.maxTokens}</div>
      </SectionPanel>
    {/if}
</Pane>

<style>
  .header-tokens { font-size: 10px; color: var(--text-muted); }
  .empty-state { color: var(--text-muted); padding: 20px; text-align: center; }
  .sections-list { font-size: 11px; color: var(--text-secondary); }
  .lint-pass { color: var(--success); font-size: 11px; }
  .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .gen-params { font-size: 11px; color: var(--text-secondary); }
</style>
