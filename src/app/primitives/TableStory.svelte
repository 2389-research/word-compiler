<script lang="ts">
import Table from "./Table.svelte";
</script>

<Table>
  <thead>
    <tr><th>Name</th><th>Value</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Avg Sentence Len</td><td>12.5%</td><td>OK</td></tr>
    <tr><td>Variance</td><td>8.2%</td><td>OK</td></tr>
    <tr><td>TTR</td><td>15.1%</td><td>Flagged</td></tr>
  </tbody>
</Table>
