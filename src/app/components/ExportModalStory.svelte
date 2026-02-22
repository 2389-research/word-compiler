<script lang="ts">
import type { ChapterArc, Chunk, ScenePlan } from "../../types/index.js";
import { createEmptyScenePlan, generateId } from "../../types/index.js";
import { ProjectStore, type SceneEntry } from "../store/project.svelte.js";
import ExportModal from "./ExportModal.svelte";

let {
  withProse = false,
  multiScene = false,
  initialFormat,
}: {
  withProse?: boolean;
  multiScene?: boolean;
  initialFormat?: "markdown" | "plaintext";
} = $props();

const store = new ProjectStore();
store.project = {
  id: "proj-1",
  title: "Story Project",
  status: "drafting",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

if (withProse) {
  const plan1: ScenePlan = { ...createEmptyScenePlan("proj-1"), id: "scene-1", title: "The Arrival" };
  store.scenes = [{ plan: plan1, status: "drafting", sceneOrder: 0 }];
  store.sceneChunks = {
    "scene-1": [
      {
        id: generateId(),
        sceneId: "scene-1",
        sequenceNumber: 0,
        generatedText:
          "The train pulled into the station just as the last light faded behind the mountains. Elena stepped onto the platform, her breath visible in the cold air. The station was nearly empty — just a porter and a cat watching from the windowsill of the ticket office.",
        editedText: null,
        humanNotes: null,
        status: "accepted",
        model: "claude-sonnet-4-6",
        temperature: 0.85,
        topP: 1,
        payloadHash: "h1",
        generatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        sceneId: "scene-1",
        sequenceNumber: 1,
        generatedText:
          "She adjusted the strap of her bag and looked for a sign. Any sign. The letter had said someone would meet her, but the platform was bare except for a bench and a flickering overhead lamp.",
        editedText:
          "She adjusted the strap of her bag and scanned the platform. The letter had promised someone would meet her, but there was only a bench and a flickering lamp overhead.",
        humanNotes: null,
        status: "edited",
        model: "claude-sonnet-4-6",
        temperature: 0.85,
        topP: 1,
        payloadHash: "h2",
        generatedAt: new Date().toISOString(),
      },
    ],
  };
  store.chapterArc = {
    id: generateId(),
    projectId: "proj-1",
    chapterNumber: 1,
    workingTitle: "The Letter",
    narrativeFunction: "Inciting incident",
    dominantRegister: "Restrained",
    pacingTarget: "Slow build",
    endingPosture: "Cliffhanger",
    readerStateEntering: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    readerStateExiting: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
  };

  if (multiScene) {
    const plan2: ScenePlan = { ...createEmptyScenePlan("proj-1"), id: "scene-2", title: "The Meeting" };
    store.scenes = [...store.scenes, { plan: plan2, status: "drafting", sceneOrder: 1 }];
    store.sceneChunks = {
      ...store.sceneChunks,
      "scene-2": [
        {
          id: generateId(),
          sceneId: "scene-2",
          sequenceNumber: 0,
          generatedText:
            "The door to the inn swung open with a groan. Inside, warmth and the smell of wood smoke. A woman at the bar looked up from her glass and smiled — not warmly, but with recognition.",
          editedText: null,
          humanNotes: null,
          status: "accepted",
          model: "claude-sonnet-4-6",
          temperature: 0.85,
          topP: 1,
          payloadHash: "h3",
          generatedAt: new Date().toISOString(),
        },
      ],
    };
  }
}
</script>

<ExportModal open={true} onClose={() => {}} {store} {initialFormat} />
