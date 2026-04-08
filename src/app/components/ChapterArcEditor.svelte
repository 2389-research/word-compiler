<script lang="ts">
import type { ChapterArc, ReaderState } from "../../types/index.js";
import { Button, Input, Modal, TextArea } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  arc,
  store,
  commands,
  onClose,
}: {
  arc: ChapterArc;
  store: ProjectStore;
  commands: Commands;
  onClose: () => void;
} = $props();

let arcDebounce: ReturnType<typeof setTimeout> | undefined;

function update(changes: Partial<ChapterArc>) {
  const updated = { ...arc, ...changes };
  clearTimeout(arcDebounce);
  arcDebounce = setTimeout(() => commands.updateChapterArc(updated), 500);
}

function updateReaderState(field: "readerStateEntering" | "readerStateExiting", rs: ReaderState) {
  update({ [field]: rs });
}

function parseCSV(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
</script>

<Modal open={true} {onClose} width="wide">
  {#snippet header()}Essay Arc Editor{/snippet}

  <div class="arc-editor">
    <label>
      Working Title
      <Input autofocus value={arc.workingTitle} oninput={(e) => update({ workingTitle: (e.target as HTMLInputElement).value })} />
    </label>
    <label>
      Narrative Function
      <TextArea
        value={arc.narrativeFunction}
        variant="compact"
        rows={2}
        oninput={(e) => update({ narrativeFunction: (e.target as HTMLTextAreaElement).value })}
      />
    </label>
    <label>
      Dominant Register
      <Input value={arc.dominantRegister} oninput={(e) => update({ dominantRegister: (e.target as HTMLInputElement).value })} />
    </label>
    <label>
      Pacing Target
      <Input value={arc.pacingTarget} oninput={(e) => update({ pacingTarget: (e.target as HTMLInputElement).value })} />
    </label>
    <label>
      Ending Posture
      <Input value={arc.endingPosture} oninput={(e) => update({ endingPosture: (e.target as HTMLInputElement).value })} />
    </label>

    {#each [
      { label: "Reader State Entering", field: "readerStateEntering" as const, state: arc.readerStateEntering },
      { label: "Reader State Exiting", field: "readerStateExiting" as const, state: arc.readerStateExiting },
    ] as section}
      <fieldset class="arc-fieldset">
        <legend>{section.label}</legend>
        <label>Knows <Input value={section.state.knows.join(", ")} oninput={(e) => updateReaderState(section.field, { ...section.state, knows: parseCSV((e.target as HTMLInputElement).value) })} placeholder="Comma-separated items" /></label>
        <label>Suspects <Input value={section.state.suspects.join(", ")} oninput={(e) => updateReaderState(section.field, { ...section.state, suspects: parseCSV((e.target as HTMLInputElement).value) })} placeholder="Comma-separated items" /></label>
        <label>Wrong about <Input value={section.state.wrongAbout.join(", ")} oninput={(e) => updateReaderState(section.field, { ...section.state, wrongAbout: parseCSV((e.target as HTMLInputElement).value) })} placeholder="Comma-separated items" /></label>
        <label>Active tensions <Input value={section.state.activeTensions.join(", ")} oninput={(e) => updateReaderState(section.field, { ...section.state, activeTensions: parseCSV((e.target as HTMLInputElement).value) })} placeholder="Comma-separated items" /></label>
      </fieldset>
    {/each}
  </div>

  {#snippet footer()}
    <Button onclick={onClose}>Close</Button>
  {/snippet}
</Modal>

<style>
  .arc-editor { display: flex; flex-direction: column; gap: 10px; }
  .arc-editor label {
    display: flex; flex-direction: column; gap: 3px;
    font-size: 11px; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .arc-fieldset {
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; margin: 0;
  }
  .arc-fieldset :global(legend) {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--accent); padding: 0 6px;
  }
</style>
