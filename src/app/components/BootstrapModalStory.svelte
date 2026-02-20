<script lang="ts">
import type { Bible } from "../../types/index.js";
import BootstrapModal from "./BootstrapModal.svelte";

let {
  initialOpen = true,
}: {
  initialOpen?: boolean;
} = $props();

class MockStore {
  bootstrapModalOpen = $state(true);
  constructor(open: boolean) {
    this.bootstrapModalOpen = open;
  }
  setBootstrapOpen(v: boolean) {
    this.bootstrapModalOpen = v;
  }
  setBible(_bible: Bible) {}
}

const store = new MockStore(initialOpen);
</script>

<BootstrapModal {store} />
