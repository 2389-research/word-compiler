<script lang="ts">
import type { Bible, ScenePlan } from "../../types/index.js";
import { createEmptyBible, createEmptyScenePlan } from "../../types/index.js";
import BiblePane from "./BiblePane.svelte";

let {
  hasBible = false,
  hasScenes = false,
}: {
  hasBible?: boolean;
  hasScenes?: boolean;
} = $props();

class MockStore {
  bible = $state<Bible | null>(null);
  activeScenePlan = $state<ScenePlan | null>(null);
  bootstrapModalOpen = $state(false);
  constructor(withBible: boolean, withScenes: boolean) {
    this.bible = withBible ? createEmptyBible("proj-1") : null;
    this.activeScenePlan = withScenes ? createEmptyScenePlan("proj-1") : null;
  }
  setBible(bible: Bible | null) {
    this.bible = bible;
  }
  setScenePlan(plan: ScenePlan | null) {
    this.activeScenePlan = plan;
  }
  setError(_msg: string) {}
  setBootstrapOpen(v: boolean) {
    this.bootstrapModalOpen = v;
  }
  loadFile() {
    return Promise.resolve(null);
  }
  saveFile() {}
}

const store = new MockStore(hasBible, hasScenes);
</script>

<BiblePane {store} onBootstrap={() => {}} />
