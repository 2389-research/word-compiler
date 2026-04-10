import type { CharacterBehavior, CharacterDossier, CompiledPayload } from "../types/index.js";
import { DEFAULT_MODEL } from "../types/index.js";
import { extractJsonFromText } from "./index.js";

// ─── Types ───────────────────────────────────────

export interface ExtractedProfile {
  vocabularyNotes: string | null;
  writingTics: string[];
  metaphoricRegister: string | null;
  prohibitedLanguage: string[];
  sentenceLengthRange: [number, number] | null;
  argumentativeStyle: string | null;
  rhetoricalApproach: string | null;
  observationalFocus: string | null;
  persuasionStyle: string | null;
  emotionalRegister: string | null;
  writingSamples: string[];
}

// ─── Schema ──────────────────────────────────────

export const profileExtractionSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    vocabularyNotes: { type: "string" },
    writingTics: { type: "array", items: { type: "string" } },
    metaphoricRegister: { type: "string" },
    prohibitedLanguage: { type: "array", items: { type: "string" } },
    sentenceLengthRange: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
    argumentativeStyle: { type: "string" },
    rhetoricalApproach: { type: "string" },
    observationalFocus: { type: "string" },
    persuasionStyle: { type: "string" },
    emotionalRegister: { type: "string" },
    writingSamples: { type: "array", items: { type: "string" } },
  },
  required: [
    "vocabularyNotes",
    "writingTics",
    "metaphoricRegister",
    "prohibitedLanguage",
    "sentenceLengthRange",
    "argumentativeStyle",
    "rhetoricalApproach",
    "observationalFocus",
    "persuasionStyle",
    "emotionalRegister",
    "writingSamples",
  ],
};

// ─── Prompt Builder ──────────────────────────────

export function buildProfileExtractionPrompt(samples: string[]): CompiledPayload {
  if (samples.length === 0) {
    throw new Error("At least one writing sample is required");
  }

  const systemMessage = `You are a writing voice analyst. Given writing samples from a single author, extract precise, evidence-based voice characteristics. Do NOT generalize — cite specific patterns you observe in the text. Every claim must be grounded in what you actually see in the samples.`;

  const samplesText = samples.map((s, i) => `--- SAMPLE ${i + 1} ---\n${s.trim()}`).join("\n\n");

  const userMessage = `WRITING SAMPLES:

${samplesText}

Analyze these samples and extract the author's distinctive voice characteristics as JSON:

{
  "vocabularyNotes": "Describe the author's vocabulary patterns, diction level, and register. Be specific: what kinds of words do they prefer? What's their formality level? Cite examples from the samples.",
  "writingTics": ["List recurring stylistic patterns — sentence fragments, parentheticals, em dashes, specific transition words, paragraph-opening habits, anything that repeats across samples"],
  "metaphoricRegister": "Where does the author draw comparisons from? What domains do their metaphors reference? Cite specific metaphors from the samples.",
  "prohibitedLanguage": ["Words or phrases that would sound wrong in this author's voice — things they clearly avoid or that would clash with their style"],
  "sentenceLengthRange": [min_words, max_words],
  "argumentativeStyle": "How does this author make arguments? Do they lead with claims or build to them? Do they use evidence or authority? Be specific.",
  "rhetoricalApproach": "How does this author persuade? Direct address? Questions? Accumulation of evidence? What's their go-to move?",
  "observationalFocus": "What does this author notice and highlight? Business dynamics? Human behavior? Technical details? Power structures?",
  "persuasionStyle": "How does this author build toward conclusions? Do they state them early or late? Do they use counterarguments?",
  "emotionalRegister": "What's the emotional temperature of this writing? Urgent? Measured? Wry? Describe the tone precisely.",
  "writingSamples": ["Select the 2-3 most representative passages (1-2 paragraphs each) that best capture this author's distinctive voice"]
}

Be PRECISE. Vague descriptions like 'writes clearly' or 'uses strong language' are useless. Every field should contain specific, actionable patterns that could distinguish this author from any other writer.`;

  return {
    systemMessage,
    userMessage,
    temperature: 0.5,
    topP: 0.9,
    maxTokens: 8192,
    model: DEFAULT_MODEL,
  };
}

// ─── Parser ──────────────────────────────────────

export function parseProfileResponse(response: string): ExtractedProfile | { error: string } {
  const result = extractJsonFromText(response);
  if (result !== null) return result as ExtractedProfile;
  return { error: "Failed to parse profile extraction response as JSON" };
}

// ─── Applier ─────────────────────────────────────

/** Fill a string field only if the current value is null/empty. */
function fillString(current: string | null, value: string | null): string | null {
  return current || value || null;
}

/** Fill an array field only if the current array is empty. */
function fillArray(current: string[], value: string[]): string[] {
  return current.length > 0 ? current : [...value];
}

/**
 * Merge extracted profile data into a CharacterDossier.
 * Fill-blank strategy: only populates fields that are null, empty, or at defaults.
 * Does not overwrite user-set values. Returns a new object (does not mutate).
 */
export function applyProfileToCharacter(char: CharacterDossier, profile: ExtractedProfile): CharacterDossier {
  const updated = structuredClone(char);

  updated.voice = {
    vocabularyNotes: fillString(updated.voice.vocabularyNotes, profile.vocabularyNotes),
    verbalTics: fillArray(updated.voice.verbalTics, profile.writingTics),
    metaphoricRegister: fillString(updated.voice.metaphoricRegister, profile.metaphoricRegister),
    prohibitedLanguage: fillArray(updated.voice.prohibitedLanguage, profile.prohibitedLanguage),
    sentenceLengthRange: updated.voice.sentenceLengthRange ?? profile.sentenceLengthRange,
    dialogueSamples: fillArray(updated.voice.dialogueSamples, profile.writingSamples),
  };

  const behavior: CharacterBehavior = updated.behavior ?? {
    stressResponse: null,
    socialPosture: null,
    noticesFirst: null,
    lyingStyle: null,
    emotionPhysicality: null,
  };
  updated.behavior = {
    stressResponse: fillString(behavior.stressResponse, profile.argumentativeStyle),
    socialPosture: fillString(behavior.socialPosture, profile.rhetoricalApproach),
    noticesFirst: fillString(behavior.noticesFirst, profile.observationalFocus),
    lyingStyle: fillString(behavior.lyingStyle, profile.persuasionStyle),
    emotionPhysicality: fillString(behavior.emotionPhysicality, profile.emotionalRegister),
  };

  return updated;
}
