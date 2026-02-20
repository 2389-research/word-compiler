<script lang="ts">
import type { Snippet } from "svelte";

let {
  variant = "default",
  children,
}: {
  variant?: "default" | "pending" | "accepted" | "edited" | "rejected" | "warning";
  children: Snippet;
} = $props();
</script>

<span class="badge badge-{variant}">{@render children()}</span>

<style>
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-default {
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }
  .badge-pending {
    background: var(--bg-secondary);
    color: var(--text-muted);
  }
  .badge-accepted {
    background: var(--badge-accepted-bg);
    color: var(--success);
  }
  .badge-edited {
    background: var(--badge-edited-bg);
    color: var(--warning);
  }
  .badge-rejected {
    background: var(--badge-rejected-bg);
    color: var(--error);
  }
  .badge-warning {
    background: var(--badge-warning-bg);
    color: var(--warning);
  }
</style>
