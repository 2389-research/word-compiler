<script lang="ts">
import { applyGenreTemplate, LITERARY_FICTION } from "../../bootstrap/genres.js";
import type { Bible } from "../../types/index.js";
import { createEmptyBible, createEmptyCharacterDossier, generateId } from "../../types/index.js";
import { createCommands } from "../store/commands.js";
import { ProjectStore } from "../store/project.svelte.js";
import BibleAuthoringModal from "./BibleAuthoringModal.svelte";

let {
  mode = "bootstrap",
  prePopulated = false,
  withGenre = false,
}: {
  mode?: "bootstrap" | "form";
  prePopulated?: boolean;
  withGenre?: boolean;
} = $props();

const store = new ProjectStore();
const commands = createCommands(store);
store.setBibleAuthoringOpen(true);

if (prePopulated) {
  const bible = createEmptyBible("story-proj");
  bible.characters = [
    {
      ...createEmptyCharacterDossier("Marcus Cole"),
      role: "protagonist",
      physicalDescription: "Weathered face, silver-threaded temples",
      backstory: "Ex-homicide detective turned bar owner",
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
  bible.styleGuide.killList = [{ pattern: "a wave of", type: "exact" }];
  store.setBible(withGenre ? applyGenreTemplate(bible, LITERARY_FICTION) : bible);
} else if (withGenre) {
  const bible = applyGenreTemplate(createEmptyBible("story-proj"), LITERARY_FICTION);
  store.setBible(bible);
}
</script>

<BibleAuthoringModal {store} {commands} initialTab={mode === "form" ? "form" : "bootstrap"} />
