import type { Bible, CompiledPayload, ScenePlan } from "../types/index.js";
import { createEmptyScenePlan, DEFAULT_MODEL, generateId } from "../types/index.js";

// Re-export profile extraction
export type { ExtractedProfile } from "./profileExtractor.js";
export {
  applyProfileToCharacter,
  buildProfileExtractionPrompt,
  parseProfileResponse,
  profileExtractionSchema,
} from "./profileExtractor.js";
export type { ParsedSceneBootstrap, SceneBootstrapParams } from "./sceneBootstrap.js";
// Re-export scene bootstrap
export {
  buildSceneBootstrapPrompt,
  mapSceneBootstrapToPlans,
  parseSceneBootstrapResponse,
} from "./sceneBootstrap.js";

// ─── Bootstrap Prompt ───────────────────────────────────

export const bootstrapSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    thesis: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          purpose: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "purpose", "keyPoints"],
      },
    },
    suggestedTone: {
      type: "object",
      additionalProperties: false,
      properties: {
        register: { type: "string" },
        audience: { type: "string" },
        pacingNotes: { type: "string" },
      },
      required: ["register", "audience", "pacingNotes"],
    },
    suggestedKillList: { type: "array", items: { type: "string" } },
    structuralBans: { type: "array", items: { type: "string" } },
  },
  required: ["thesis", "sections", "suggestedTone", "suggestedKillList", "structuralBans"],
};

export function buildBootstrapPrompt(synopsis: string): CompiledPayload {
  const systemMessage = `You are an editorial analyst. Given an essay brief or idea, extract a structured essay plan. Be specific and opinionated — generic structure is useless.`;

  const userMessage = `ESSAY BRIEF:
${synopsis}

Extract the following as JSON:

{
  "thesis": "The essay's central argument in one clear sentence. Not a topic — an argument. Not 'AI writing tools' but 'AI writing tools fail because they treat voice as a prompt, not a learning problem.'",
  "sections": [
    {
      "heading": "Section heading — sharp, not generic",
      "purpose": "What this section argues or establishes. One sentence.",
      "keyPoints": ["Specific points this section must make — not vague themes, concrete claims"]
    }
  ],
  "suggestedTone": {
    "register": "The voice register: conversational, formal-academic, casual-authoritative, etc. Be specific about diction level.",
    "audience": "Who is reading this and what do they already know?",
    "pacingNotes": "How should the argument unfold? Build slowly? Hit hard from the start?"
  },
  "suggestedKillList": [
    "Topic-specific cliches and phrases this essay must avoid — the tired language of this particular subject"
  ],
  "structuralBans": [
    "Structural patterns to avoid — e.g. 'Do not open with a dictionary definition', 'Do not end with a call to action'"
  ]
}

Be OPINIONATED. A good essay plan takes a strong position and structures an argument to support it. If the brief is vague, sharpen it — make a specific argumentative choice and flag it as [ASSUMPTION] so the author can override. Every section should advance the argument, not just cover a topic.`;

  return {
    systemMessage,
    userMessage,
    temperature: 0.7,
    topP: 0.92,
    maxTokens: 16384,
    model: DEFAULT_MODEL,
  };
}

// ─── JSON Extraction (shared by both parse functions) ───

/** Try parsing the entire string as JSON. */
function tryDirectParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Try stripping markdown code fences (closed or unclosed) and parsing. */
function tryFenceParse(text: string): unknown | null {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    const result = tryDirectParse(fenceMatch[1]);
    if (result !== null) return result;
  }

  // Strip opening fence even if unclosed (LLM ran out of tokens)
  const stripped = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  if (stripped !== text) {
    return tryDirectParse(stripped);
  }

  return null;
}

/** Extract first {...} block by brace-depth counting and parse. */
function tryBraceDepthParse(text: string): unknown | null {
  // Use fence-stripped text if fences were present
  const stripped = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  const source = stripped !== text ? stripped : text;
  const startIdx = source.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) {
      return tryDirectParse(source.slice(startIdx, i + 1));
    }
  }
  return null;
}

/**
 * 3-tier JSON extraction: direct parse → fence strip → brace-depth counting.
 * Returns the parsed object or null on failure.
 */
export function extractJsonFromText(text: string): unknown | null {
  return tryDirectParse(text) ?? tryFenceParse(text) ?? tryBraceDepthParse(text);
}

// ─── Parse Bootstrap Response ───────────────────────────

export interface ParsedBootstrap {
  thesis?: string;
  sections?: Array<{
    heading: string;
    purpose: string;
    keyPoints?: string[];
  }>;
  suggestedTone?: {
    register?: string;
    audience?: string;
    pacingNotes?: string;
  };
  suggestedKillList?: string[];
  structuralBans?: string[];
}

export function parseBootstrapResponse(response: string): ParsedBootstrap | { error: string; rawText: string } {
  const result = extractJsonFromText(response);
  if (result !== null) return result as ParsedBootstrap;
  return { error: "Failed to parse bootstrap response as JSON", rawText: response };
}

// ─── Bootstrap → Bible ──────────────────────────────────

// Default kill list: AI slop words and phrases that mark text as machine-generated
const DEFAULT_KILL_LIST: string[] = [
  "delve",
  "tapestry",
  "nuanced",
  "multifaceted",
  "landscape",
  "robust",
  "comprehensive",
  "furthermore",
  "moreover",
  "utilize",
  "leverage",
  "facilitate",
  "elucidate",
  "embark",
  "endeavor",
  "encompass",
  "paradigm",
  "synergy",
  "holistic",
  "catalyze",
  "juxtapose",
  "realm",
  "myriad",
  "plethora",
  "meticulous",
  "interplay",
  "intricate",
  "garner",
  "underscore",
  "vibrant",
  "nestled",
  "groundbreaking",
  "renowned",
  "pivotal",
  "cornerstone",
  "foster",
  "showcase",
  "it's important to note",
  "it's worth noting",
  "in today's world",
  "in today's fast-paced",
  "let's dive in",
  "let's explore",
  "without further ado",
  "at the end of the day",
  "first and foremost",
  "game-changer",
  "a testament to",
  "serves as a reminder",
  "the power of",
  "needless to say",
  "in conclusion",
  "it goes without saying",
  "when it comes to",
  "in the realm of",
  "at its core",
];

const DEFAULT_STRUCTURAL_BANS: string[] = [
  "Never open a paragraph with However, Moreover, Furthermore, Additionally, or In fact",
  "Never use 'This is not just X — it's Y' framing",
  "Never write 'This matters because' or 'This is significant because' immediately after a claim",
  "Never end a section by restating what it just said",
  "Never use three consecutive sentences with the same grammatical structure",
  "Never start with a rhetorical question then immediately answer it",
  "Limit em dashes to 2 per 500 words",
];

export function bootstrapToBible(parsed: ParsedBootstrap, projectId: string, sourcePrompt?: string): Bible {
  const tone = parsed.suggestedTone;

  // Create a single "character" representing the author persona
  const authorPersona = {
    id: generateId(),
    name: "Author",
    role: "protagonist" as const,
    physicalDescription: null,
    backstory: null,
    selfNarrative: null,
    contradictions: null,
    voice: {
      sentenceLengthRange: null,
      vocabularyNotes: tone?.register || null,
      verbalTics: [],
      metaphoricRegister: null,
      prohibitedLanguage: [],
      dialogueSamples: [],
    },
    behavior: null,
  };

  // Merge default kill list with bootstrap-generated additions (deduplicated)
  const bootstrapKills = parsed.suggestedKillList || [];
  const allKills = [...new Set([...DEFAULT_KILL_LIST, ...bootstrapKills])];

  // Merge default structural bans with bootstrap-generated additions
  const bootstrapBans = parsed.structuralBans || [];
  const allBans = [...new Set([...DEFAULT_STRUCTURAL_BANS, ...bootstrapBans])];

  return {
    projectId,
    version: 1,
    characters: [authorPersona],
    styleGuide: {
      metaphoricRegister: null,
      vocabularyPreferences: [],
      sentenceArchitecture: null,
      paragraphPolicy: null,
      killList: allKills.map((phrase) => ({
        pattern: phrase,
        type: "exact" as const,
      })),
      negativeExemplars: [],
      positiveExemplars: [],
      structuralBans: allBans,
    },
    narrativeRules: {
      pov: {
        default: "first",
        distance: "close",
        interiority: "filtered",
        reliability: "reliable",
        notes:
          [
            parsed.thesis ? `Thesis: ${parsed.thesis}` : null,
            tone?.register ? `Register: ${tone.register}` : null,
            tone?.audience ? `Audience: ${tone.audience}` : null,
            tone?.pacingNotes || null,
          ]
            .filter(Boolean)
            .join(". ") || undefined,
      },
      subtextPolicy: null,
      expositionPolicy: parsed.sections
        ? parsed.sections.map((s, i) => `${i + 1}. ${s.heading}: ${s.purpose}`).join("\n")
        : null,
      sceneEndingPolicy: null,
      setups: [],
    },
    locations: [],
    createdAt: new Date().toISOString(),
    sourcePrompt: sourcePrompt ?? null,
  };
}

// ─── Bootstrap → Section Plans ────────────────────────

/**
 * Convert extracted sections from the bootstrap response into ScenePlans.
 * Returns an empty array if no sections were extracted.
 */
export function bootstrapToScenePlans(
  parsed: ParsedBootstrap,
  projectId: string,
  authorCharacterId: string,
): ScenePlan[] {
  if (!parsed.sections || parsed.sections.length === 0) return [];

  return parsed.sections.map((section) => {
    const plan = createEmptyScenePlan(projectId);
    plan.title = section.heading;
    plan.narrativeGoal = section.purpose;
    plan.povCharacterId = authorCharacterId;
    plan.failureModeToAvoid = `Generic summary without a clear argument. This section must ${section.purpose.toLowerCase()}, not just describe it.`;
    plan.chunkDescriptions = section.keyPoints || [];
    plan.chunkCount = Math.max(1, (section.keyPoints || []).length);
    plan.estimatedWordCount = [300, 600];
    return plan;
  });
}
