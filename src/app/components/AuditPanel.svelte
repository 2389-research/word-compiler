<script lang="ts">
import { getAuditStats } from "../../auditor/index.js";
import type { AuditFlag } from "../../types/index.js";
import {
  Badge,
  Button,
  CollapsibleSection,
  DiagnosticItem,
  Input,
  SectionPanel,
  SegmentedBar,
} from "../primitives/index.js";

let {
  flags,
  onResolve,
  onDismiss,
}: {
  flags: AuditFlag[];
  onResolve: (flagId: string, action: string) => void;
  onDismiss: (flagId: string) => void;
} = $props();

let resolveInput = $state<Record<string, string>>({});

let stats = $derived(getAuditStats(flags));
let critical = $derived(flags.filter((f) => f.severity === "critical" && !f.resolved));
let warnings = $derived(flags.filter((f) => f.severity === "warning" && !f.resolved));
let infos = $derived(flags.filter((f) => f.severity === "info" && !f.resolved));
let resolved = $derived(flags.filter((f) => f.resolved));

function handleResolve(flagId: string) {
  const action = resolveInput[flagId] ?? "";
  if (!action.trim()) return;
  onResolve(flagId, action);
  const next = { ...resolveInput };
  delete next[flagId];
  resolveInput = next;
}
</script>

<SectionPanel title="Audit">
  {#snippet badge()}<span class="audit-summary">{stats.pending} pending | {Math.round(stats.signalToNoiseRatio * 100)}% actionable</span>{/snippet}

  {#if stats.total > 0 && stats.actionable + stats.nonActionable > 0}
    <div class="signal-meter">
      <SegmentedBar
        segments={[
          { label: `${stats.actionable} actionable`, flex: stats.actionable, variant: "actionable" },
          { label: `${stats.nonActionable} noise`, flex: stats.nonActionable, variant: "noise" },
        ]}
        height={8}
      />
      <div class="signal-label">
        {stats.actionable} actionable / {stats.nonActionable} noise
        {#if stats.signalToNoiseRatio < 0.6} — below 60% target{/if}
      </div>
    </div>
  {/if}

  {#if flags.length === 0}
    <div class="audit-empty">No audit flags. Run an audit after generating chunks.</div>
  {/if}

  {#each critical as flag (flag.id)}
    {@render auditFlag(flag)}
  {/each}
  {#each warnings as flag (flag.id)}
    {@render auditFlag(flag)}
  {/each}
  {#each infos as flag (flag.id)}
    {@render auditFlag(flag)}
  {/each}

  {#if resolved.length > 0}
    <CollapsibleSection summary="{resolved.length} resolved">
      {#each resolved as flag (flag.id)}
        <div class="resolved-flag">
          <DiagnosticItem severity={flag.severity} message="[{flag.category}] {flag.message}">
            {#snippet actions()}
              {#if flag.resolvedAction}
                <span class="resolved-action">Action: {flag.resolvedAction}</span>
              {/if}
              <Badge>{flag.wasActionable ? "actionable" : "dismissed"}</Badge>
            {/snippet}
          </DiagnosticItem>
        </div>
      {/each}
    </CollapsibleSection>
  {/if}

  {#if Object.keys(stats.byCategory).length > 0}
    <CollapsibleSection summary="Category breakdown">
      <div class="category-list">
        {#each Object.entries(stats.byCategory) as [cat, data]}
          <div>{cat}: {data.total} total, {data.actionable} actionable</div>
        {/each}
      </div>
    </CollapsibleSection>
  {/if}
</SectionPanel>

{#snippet auditFlag(flag: AuditFlag)}
  <DiagnosticItem severity={flag.severity} message="[{flag.category}] {flag.message}{flag.lineReference ? ` (${flag.lineReference})` : ''}">
    {#snippet actions()}
      {#if !flag.resolved}
        <Input
          placeholder="What did you do?"
          value={resolveInput[flag.id] ?? ""}
          oninput={(e) => { resolveInput = { ...resolveInput, [flag.id]: (e.target as HTMLInputElement).value }; }}
          onkeydown={(e) => { if (e.key === "Enter") handleResolve(flag.id); }}
        />
        <Button size="sm" onclick={() => handleResolve(flag.id)}>Resolve</Button>
        <Button size="sm" onclick={() => onDismiss(flag.id)}>Dismiss</Button>
      {/if}
    {/snippet}
  </DiagnosticItem>
{/snippet}

<style>
  .audit-summary { font-size: 10px; }
  .signal-meter { padding: 4px 0; margin-bottom: 6px; }
  .signal-label { font-size: 9px; color: var(--text-muted); margin-top: 2px; }
  .audit-empty { color: var(--text-muted); font-size: 11px; padding: 8px 0; }
  .resolved-flag { opacity: 0.5; }
  .resolved-action { font-size: 10px; color: var(--text-muted); }
  .category-list { font-size: 10px; padding: 4px 0; color: var(--text-secondary); }
</style>
