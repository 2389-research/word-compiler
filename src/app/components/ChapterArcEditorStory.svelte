<script lang="ts">
import type { ChapterArc } from "../../types/index.js";
import { createEmptyChapterArc } from "../../types/index.js";
import ChapterArcEditor from "./ChapterArcEditor.svelte";

let {
  prefilled = false,
}: {
  prefilled?: boolean;
} = $props();

const emptyArc = createEmptyChapterArc("proj-1", 1);
const filledArc: ChapterArc = {
  ...emptyArc,
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

let arc = $state(emptyArc);

class MockStore {
  setChapterArc(newArc: ChapterArc | null) {
    if (newArc) arc = newArc;
  }
}

const store = new MockStore();

// Apply prefilled data after initialization
if (prefilled) {
  arc = filledArc;
}
</script>

<ChapterArcEditor {arc} {store} onClose={() => {}} />
