<script lang="ts">
import { createEmptyBible } from "../../types/index.js";
import { createCommands } from "../store/commands.js";
import { ProjectStore } from "../store/project.svelte.js";
import SceneAuthoringModal from "./SceneAuthoringModal.svelte";

let {
  withBible = false,
  richData = false,
  initialTab,
}: {
  withBible?: boolean;
  richData?: boolean;
  initialTab?: "bootstrap" | "form";
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
  if (richData) {
    bible.characters.push({
      id: "c3",
      name: "Tomás Reyes",
      role: "supporting",
      physicalDescription: "Lean build, ink-stained fingers, perpetual squint",
      backstory: "Freelance journalist who covered the original scandal",
      selfNarrative: "Believes he failed to break the story when it mattered",
      contradictions: "Claims to seek truth but selectively omits facts that implicate his source",
      voice: {
        sentenceLengthRange: "5-15",
        vocabularyNotes: "Journalistic shorthand, clipped phrasing",
        verbalTics: ["look", "here's the thing"],
        metaphoricRegister: "ink, print, exposure",
        prohibitedLanguage: [],
        dialogueSamples: ["Look, I don't print what I can't source. That's the line."],
      },
      behavior: "Fidgets with a pen, avoids sustained eye contact when lying",
    });
    bible.locations.push({
      id: "l3",
      name: "The Ninth Floor",
      description: "Abandoned newspaper office above a parking garage",
      sensoryPalette: {
        sounds: ["wind through broken windows", "distant traffic"],
        smells: ["dust", "old newsprint", "pigeon droppings"],
        textures: ["peeling laminate", "gritty floor"],
        lightQuality: "Harsh fluorescent tubes, half dead",
        atmosphere: "Abandoned institutional decay",
        prohibitedDefaults: [],
      },
    });
  }

  store.setBible(bible);
}
</script>

<SceneAuthoringModal {store} {commands} {initialTab} />
