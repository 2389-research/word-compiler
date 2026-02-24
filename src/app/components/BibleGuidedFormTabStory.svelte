<script lang="ts">
import { onMount } from "svelte";
import { applyGenreTemplate, LITERARY_FICTION } from "../../bootstrap/genres.js";
import type { Bible } from "../../types/index.js";
import { createEmptyBible, createEmptyCharacterDossier, generateId } from "../../types/index.js";
import BibleGuidedFormTab from "./BibleGuidedFormTab.svelte";

let {
  prePopulated = false,
  withGenre = false,
  initialStep = "foundations",
}: {
  prePopulated?: boolean;
  withGenre?: boolean;
  initialStep?: "foundations" | "characters" | "locations" | "style" | "review";
} = $props();

const STEPS = ["foundations", "characters", "locations", "style", "review"];

function buildInitialBible(): Bible {
  let bible = createEmptyBible("story-proj");

  if (prePopulated) {
    bible.characters = [
      {
        ...createEmptyCharacterDossier("Marcus Cole"),
        role: "protagonist",
        physicalDescription: "Weathered face, silver-threaded temples",
        backstory: "Ex-homicide detective turned bar owner",
        voice: {
          sentenceLengthRange: [8, 20],
          vocabularyNotes: "Clipped, concrete. Avoids abstractions.",
          verbalTics: ["look", "listen"],
          metaphoricRegister: "machinery, weather",
          prohibitedLanguage: ["literally", "basically"],
          dialogueSamples: ["Look, I don't do favors. But I'll do this."],
        },
      },
      {
        ...createEmptyCharacterDossier("Elena Voss"),
        role: "antagonist",
        physicalDescription: "Tailored suits, watchful eyes",
        backstory: "Corporate fixer with a private moral code",
      },
    ];
    bible.locations = [
      {
        id: generateId(),
        name: "The Velvet",
        description: "Jazz bar in a decaying waterfront district",
        sensoryPalette: {
          sounds: ["muted trumpet", "ice clinking"],
          smells: ["bourbon", "old wood"],
          textures: ["worn leather", "sticky bar top"],
          lightQuality: "Amber neon through dirty glass",
          atmosphere: "Melancholy warmth",
          prohibitedDefaults: [],
        },
      },
    ];
    bible.styleGuide.killList = [
      { pattern: "a wave of", type: "exact" },
      { pattern: "suddenly", type: "exact" },
      { pattern: "couldn't help but", type: "structural" },
    ];
    bible.styleGuide.metaphoricRegister = {
      approvedDomains: ["machinery", "weather", "corrosion"],
      prohibitedDomains: ["flowers", "sunshine"],
    };
    bible.styleGuide.vocabularyPreferences = [
      { preferred: "illuminate", insteadOf: "light up" },
      { preferred: "observe", insteadOf: "see" },
    ];
  }

  if (withGenre) {
    bible = applyGenreTemplate(bible, LITERARY_FICTION);
  }

  return bible;
}

const initialBible = buildInitialBible();
let tabRef: BibleGuidedFormTab | undefined = $state();

async function handleSave() {
  // no-op in story
}

onMount(() => {
  const target = STEPS.indexOf(initialStep);
  if (target > 0 && tabRef) {
    // Defer so the component's own $effect (which resets to "foundations") runs first
    setTimeout(() => {
      for (let i = 0; i < target; i++) {
        tabRef?.next();
      }
    }, 0);
  }
});
</script>

<div style="max-width: 560px; padding: 16px;">
  <BibleGuidedFormTab
    bind:this={tabRef}
    {initialBible}
    open={true}
    onSave={handleSave}
  />
</div>
