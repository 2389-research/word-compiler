<script lang="ts">
import type { Bible, ChapterArc, ScenePlan } from "../../types/index.js";
import { createEmptyBible, createEmptyChapterArc, createEmptyScenePlan } from "../../types/index.js";
import { createCommands } from "../store/commands.js";
import AtlasPane from "./AtlasPane.svelte";

let {
  hasBible = false,
  hasScenes = false,
  hasArc = false,
}: {
  hasBible?: boolean;
  hasScenes?: boolean;
  hasArc?: boolean;
} = $props();

class MockStore {
  bible = $state<Bible | null>(null);
  activeScenePlan = $state<ScenePlan | null>(null);
  chapterArc = $state<ChapterArc | null>(null);
  scenes = $state<any[]>([]);
  bootstrapModalOpen = $state(false);
  constructor(withBible: boolean, withScenes: boolean, withArc: boolean) {
    this.bible = withBible ? createEmptyBible("proj-1") : null;
    this.activeScenePlan = withScenes ? createEmptyScenePlan("proj-1") : null;
    if (withArc) {
      const arc = createEmptyChapterArc("proj-1", 1);
      this.chapterArc = {
        ...arc,
        workingTitle: "The Letter",
        narrativeFunction: "Inciting incident — shatters Alice's false sense of security",
        dominantRegister: "Restrained → explosive",
        pacingTarget: "Slow build in scenes 1-2, rapid acceleration in scene 3",
        endingPosture: "Cliffhanger — Bob's accusation hangs unanswered",
        readerStateEntering: {
          knows: ["Alice is a journalist investigating corruption"],
          suspects: ["Bob may be hiding something"],
          wrongAbout: ["Marcus is a stranger to Alice"],
          activeTensions: ["Will Alice find evidence?"],
        },
        readerStateExiting: {
          knows: ["Alice is a journalist", "Bob lied about his alibi"],
          suspects: ["Marcus is connected to the cover-up"],
          wrongAbout: [],
          activeTensions: ["What will Alice do with the letter?", "Is Bob dangerous?"],
        },
      };
    }
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

const store = new MockStore(hasBible, hasScenes, hasArc);
const commands = createCommands(store as any);
</script>

<AtlasPane {store} {commands} onBootstrap={() => {}} />
