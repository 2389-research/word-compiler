<script lang="ts">
import { createEmptyBible } from "../../types/index.js";
import { createCommands } from "../store/commands.js";
import { ProjectStore } from "../store/project.svelte.js";
import SceneAuthoringModal from "./SceneAuthoringModal.svelte";

let {
  withBible = false,
}: {
  withBible?: boolean;
} = $props();

const store = new ProjectStore();
const commands = createCommands(store);
store.setSceneAuthoringOpen(true);

if (withBible) {
  const bible = createEmptyBible("story-proj");
  bible.characters = [
    {
      id: "c1",
      name: "Marcus Cole",
      role: "protagonist",
      physicalDescription: "Weathered face, silver-threaded temples",
      backstory: "Ex-homicide detective",
      selfNarrative: null,
      contradictions: null,
      voice: {
        sentenceLengthRange: null,
        vocabularyNotes: null,
        verbalTics: [],
        metaphoricRegister: null,
        prohibitedLanguage: [],
        dialogueSamples: [],
      },
      behavior: null,
    },
    {
      id: "c2",
      name: "Elena Voss",
      role: "antagonist",
      physicalDescription: "Tailored suits, watchful eyes",
      backstory: "Corporate fixer",
      selfNarrative: null,
      contradictions: null,
      voice: {
        sentenceLengthRange: null,
        vocabularyNotes: null,
        verbalTics: [],
        metaphoricRegister: null,
        prohibitedLanguage: [],
        dialogueSamples: [],
      },
      behavior: null,
    },
  ];
  bible.locations = [
    {
      id: "l1",
      name: "The Velvet",
      description: "Jazz bar",
      sensoryPalette: {
        sounds: [],
        smells: [],
        textures: [],
        lightQuality: null,
        atmosphere: null,
        prohibitedDefaults: [],
      },
    },
    {
      id: "l2",
      name: "Harbor District",
      description: "Waterfront",
      sensoryPalette: {
        sounds: [],
        smells: [],
        textures: [],
        lightQuality: null,
        atmosphere: null,
        prohibitedDefaults: [],
      },
    },
  ];
  store.setBible(bible);
}
</script>

<SceneAuthoringModal {store} {commands} />
