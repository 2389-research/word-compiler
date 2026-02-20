<script lang="ts">
let { size = "md" }: { size?: "sm" | "md" } = $props();
</script>

<span class="spinner spinner-{size}" role="status" aria-label="Loading"></span>

<style>
  .spinner {
    display: inline-block;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .spinner-sm { width: 10px; height: 10px; }
  .spinner-md { width: 16px; height: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
