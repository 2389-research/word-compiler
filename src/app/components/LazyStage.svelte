<script lang="ts">
import type { Component } from "svelte";
import Spinner from "../primitives/Spinner.svelte";

let {
  loader,
  props,
}: {
  loader: () => Promise<{ default: Component }>;
  props: Record<string, unknown>;
} = $props();

let Loaded = $state<Component | null>(null);
let error = $state<string | null>(null);

$effect(() => {
  Loaded = null;
  error = null;
  loader()
    .then((mod) => {
      Loaded = mod.default;
    })
    .catch((err) => {
      error = err instanceof Error ? err.message : "Failed to load stage";
    });
});
</script>

{#if error}
  <div class="lazy-error">
    <p>Failed to load: {error}</p>
  </div>
{:else if Loaded}
  <Loaded {...props} />
{:else}
  <div class="lazy-loading">
    <Spinner />
  </div>
{/if}

<style>
  .lazy-loading { display: flex; align-items: center; justify-content: center; padding: 48px; }
  .lazy-error { display: flex; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary); }
</style>
