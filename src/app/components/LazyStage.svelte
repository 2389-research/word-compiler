<script lang="ts" generics="Props extends Record<string, any>">
import Spinner from "../primitives/Spinner.svelte";

let {
  loader,
  props,
}: {
  loader: () => Promise<{ default: import("svelte").Component<Props> }>;
  props: Props;
} = $props();

let Component = $state<import("svelte").Component<Props> | null>(null);
let error = $state<string | null>(null);

$effect(() => {
  Component = null;
  error = null;
  loader()
    .then((mod) => {
      Component = mod.default;
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
{:else if Component}
  <Component {...props} />
{:else}
  <div class="lazy-loading">
    <Spinner />
  </div>
{/if}

<style>
  .lazy-loading { display: flex; align-items: center; justify-content: center; padding: 48px; }
  .lazy-error { display: flex; align-items: center; justify-content: center; padding: 48px; color: var(--text-secondary); }
</style>
