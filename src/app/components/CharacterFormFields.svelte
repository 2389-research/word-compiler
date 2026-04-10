<script lang="ts">
import { applyProfileToCharacter, buildProfileExtractionPrompt, parseProfileResponse } from "../../bootstrap/profileExtractor.js";
import { callLLM } from "../../llm/client.js";
import type { CharacterDossier } from "../../types/index.js";
import {
  Button,
  CollapsibleSection,
  ErrorBanner,
  ExamplesDrawer,
  FormField,
  Input,
  NumberRange,
  RadioGroup,
  Spinner,
  TagInput,
  TextArea,
} from "../primitives/index.js";
import { getExamples } from "./field-examples.js";
import { profileExtractionSchema } from "../../bootstrap/profileExtractor.js";

let {
  character,
  onUpdate,
}: {
  character: CharacterDossier;
  onUpdate: (changes: Partial<CharacterDossier>) => void;
} = $props();

let showExtractor = $state(false);
let extractorText = $state("");
let extracting = $state(false);
let extractError = $state<string | null>(null);
let extractResult = $state<string | null>(null);

async function handleExtractVoice() {
  if (!extractorText.trim()) return;

  extracting = true;
  extractError = null;
  extractResult = null;

  try {
    const samples = extractorText.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
    const payload = buildProfileExtractionPrompt(samples);

    const rawJson = await callLLM(
      payload.systemMessage,
      payload.userMessage,
      payload.model,
      payload.maxTokens,
      profileExtractionSchema as Record<string, unknown>,
    );

    const parsed = parseProfileResponse(rawJson);
    if ("error" in parsed) {
      extractError = parsed.error;
      extracting = false;
      return;
    }

    const updated = applyProfileToCharacter(character, parsed);
    onUpdate(updated);

    const filled: string[] = [];
    if (parsed.vocabularyNotes) filled.push("vocabulary notes");
    if (parsed.writingTics.length > 0) filled.push(`${parsed.writingTics.length} writing tics`);
    if (parsed.metaphoricRegister) filled.push("metaphoric register");
    if (parsed.prohibitedLanguage.length > 0) filled.push(`${parsed.prohibitedLanguage.length} prohibited words`);
    if (parsed.sentenceLengthRange) filled.push("sentence length range");
    if (parsed.writingSamples.length > 0) filled.push(`${parsed.writingSamples.length} writing samples`);
    if (parsed.argumentativeStyle) filled.push("argumentative style");

    extractResult = `Extracted: ${filled.join(", ")}`;
    showExtractor = false;
    extractorText = "";
  } catch (err) {
    extractError = err instanceof Error ? err.message : "Extraction failed";
  } finally {
    extracting = false;
  }
}
</script>

<div class="char-form-fields">
  {#if !showExtractor}
    <div class="extract-voice-bar">
      <Button variant="primary" size="sm" onclick={() => { showExtractor = true; extractResult = null; }}>
        Extract Voice from Writing Samples
      </Button>
      {#if extractResult}
        <span class="extract-result">{extractResult}</span>
      {/if}
    </div>
  {:else}
    <div class="extract-voice-panel">
      <p class="extract-instructions">Paste 3-5 passages of your writing below. Separate multiple passages with a line containing only <code>---</code>.</p>
      <TextArea bind:value={extractorText} rows={8} placeholder="Paste your writing here..." />
      {#if extractError}
        <ErrorBanner message={extractError} />
      {/if}
      <div class="extract-actions">
        <Button variant="primary" onclick={handleExtractVoice} disabled={extracting || !extractorText.trim()}>
          {#if extracting}<Spinner size="sm" /> Analyzing...{:else}Analyze Writing{/if}
        </Button>
        <Button onclick={() => { showExtractor = false; extractError = null; }}>Cancel</Button>
      </div>
    </div>
  {/if}
  <FormField label="Name" fieldId="characterName" required>
    <Input value={character.name} oninput={(e) => onUpdate({ name: (e.target as HTMLInputElement).value })} placeholder="Name" />
  </FormField>
  <FormField label="Role" fieldId="characterRole">
    <RadioGroup name={`charRole-${character.id}`} value={character.role} options={[
      { value: "protagonist", label: "Primary Author" },
      { value: "antagonist", label: "Counterpoint Voice" },
      { value: "supporting", label: "Referenced Voice" },
      { value: "minor", label: "Minor Reference" },
    ]} onchange={(v) => onUpdate({ role: v as CharacterDossier["role"] })} />
  </FormField>

  <CollapsibleSection summary="Background" priority="helpful" sectionId={`bible-char-appearance-${character.id}`}>
    <div class="char-section">
      <FormField label="Author Bio" fieldId="physicalDescription">
        <TextArea value={character.physicalDescription ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ physicalDescription: (e.target as HTMLTextAreaElement).value || null })} placeholder="Brief professional or personal bio" />
      </FormField>
      <FormField label="Background / Expertise" fieldId="backstory">
        <TextArea value={character.backstory ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ backstory: (e.target as HTMLTextAreaElement).value || null })} placeholder="What gives this voice authority on this topic?" />
      </FormField>
    </div>
  </CollapsibleSection>

  <CollapsibleSection summary="Voice" priority="helpful" sectionId={`bible-char-voice-${character.id}`}>
    <div class="char-section">
      <FormField label="Vocabulary Notes (Writing Style)" fieldId="vocabularyNotes">
        <TextArea value={character.voice.vocabularyNotes ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ voice: { ...character.voice, vocabularyNotes: (e.target as HTMLTextAreaElement).value || null } })} />
        <ExamplesDrawer fieldId="vocabularyNotes" examples={getExamples("vocabularyNotes")} onApplyTemplate={(content) => onUpdate({ voice: { ...character.voice, vocabularyNotes: content } })} />
      </FormField>
      <FormField label="Writing Tics (Recurring Patterns)" fieldId="verbalTics">
        <TagInput tags={character.voice.verbalTics} onchange={(v) => onUpdate({ voice: { ...character.voice, verbalTics: v } })} placeholder="parentheticals, em dashes, sentence fragments..." />
      </FormField>
      <FormField label="Metaphoric Register" fieldId="metaphoricRegister">
        <Input value={character.voice.metaphoricRegister ?? ""} oninput={(e) => onUpdate({ voice: { ...character.voice, metaphoricRegister: (e.target as HTMLInputElement).value || null } })} />
      </FormField>
      <FormField label="Prohibited Language" fieldId="prohibitedLanguage">
        <TagInput tags={character.voice.prohibitedLanguage} onchange={(v) => onUpdate({ voice: { ...character.voice, prohibitedLanguage: v } })} placeholder="Words you would never write..." />
      </FormField>
      <FormField label="Writing Samples" fieldId="dialogueSamples">
        <TagInput tags={character.voice.dialogueSamples} onchange={(v) => onUpdate({ voice: { ...character.voice, dialogueSamples: v } })} placeholder="Paste 2-3 representative passages from your writing..." />
      </FormField>
      <FormField label="Sentence Length Range" fieldId="sentenceLengthRange">
        <NumberRange
          value={character.voice.sentenceLengthRange ?? [5, 25]}
          onchange={(v) => onUpdate({ voice: { ...character.voice, sentenceLengthRange: v } })}
          labels={["min", "max"]}
        />
      </FormField>
    </div>
  </CollapsibleSection>

  <CollapsibleSection summary="Writing Tendencies" priority="advanced" sectionId={`bible-char-behavior-${character.id}`}>
    <div class="char-section">
      <FormField label="Argumentative Style" fieldId="stressResponse">
        <TextArea value={character.behavior?.stressResponse ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), stressResponse: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Rhetorical Approach" fieldId="socialPosture">
        <TextArea value={character.behavior?.socialPosture ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), socialPosture: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Observational Focus" fieldId="noticesFirst">
        <TextArea value={character.behavior?.noticesFirst ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), noticesFirst: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Persuasion Style" fieldId="lyingStyle">
        <TextArea value={character.behavior?.lyingStyle ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), lyingStyle: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Emotional Register" fieldId="emotionPhysicality">
        <TextArea value={character.behavior?.emotionPhysicality ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), emotionPhysicality: (e.target as HTMLTextAreaElement).value || null } })} />
        <ExamplesDrawer fieldId="emotionPhysicality" examples={getExamples("emotionPhysicality")} onApplyTemplate={(content) => onUpdate({ behavior: { ...(character.behavior ?? {}), emotionPhysicality: content } })} />
      </FormField>
    </div>
  </CollapsibleSection>
</div>

<style>
  .char-form-fields { display: flex; flex-direction: column; gap: 8px; }
  .char-section { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
  .extract-voice-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .extract-result { font-size: 11px; color: var(--text-secondary); }
  .extract-voice-panel {
    padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;
    margin-bottom: 8px;
  }
  .extract-instructions { font-size: 11px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
  .extract-instructions code { font-size: 10px; background: var(--bg-input); padding: 1px 4px; border-radius: 2px; }
  .extract-actions { display: flex; gap: 6px; }
</style>
