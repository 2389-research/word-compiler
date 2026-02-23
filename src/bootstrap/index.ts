import type { Bible, CompiledPayload } from "../types/index.js";
import { generateId } from "../types/index.js";

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
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          physicalDescription: { type: "string" },
          backstory: { type: "string" },
          voiceNotes: { type: "string" },
          emotionPhysicality: { type: "string" },
        },
        required: ["name", "role", "physicalDescription", "backstory", "voiceNotes", "emotionPhysicality"],
      },
    },
    locations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          sensoryPalette: {
            type: "object",
            additionalProperties: false,
            properties: {
              sounds: { type: "array", items: { type: "string" } },
              smells: { type: "array", items: { type: "string" } },
              textures: { type: "array", items: { type: "string" } },
              lightQuality: { type: "string" },
              prohibitedDefaults: { type: "array", items: { type: "string" } },
            },
            required: ["sounds", "smells", "textures", "lightQuality", "prohibitedDefaults"],
          },
        },
        required: ["name", "sensoryPalette"],
      },
    },
    suggestedTone: {
      type: "object",
      additionalProperties: false,
      properties: {
        metaphoricDomains: { type: "array", items: { type: "string" } },
        prohibitedDomains: { type: "array", items: { type: "string" } },
        pacingNotes: { type: "string" },
        interiority: { type: "string" },
      },
      required: ["metaphoricDomains", "prohibitedDomains", "pacingNotes", "interiority"],
    },
    suggestedKillList: { type: "array", items: { type: "string" } },
  },
  required: ["characters", "locations", "suggestedTone", "suggestedKillList"],
};

export function buildBootstrapPrompt(synopsis: string): CompiledPayload {
  const systemMessage = `You are a literary analyst. Given a synopsis, extract structured elements for a story bible. Be specific and opinionated — generic descriptions are useless.`;

  const userMessage = `SYNOPSIS:
${synopsis}

Extract the following as JSON:

{
  "characters": [
    {
      "name": "...",
      "role": "protagonist|antagonist|supporting|minor",
      "physicalDescription": "Specific. Not 'tall and handsome.' What does the reader SEE?",
      "backstory": "Brief but specific.",
      "voiceNotes": "How does this person TALK? Short sentences or long? Formal or casual? What words would they never use?",
      "emotionPhysicality": "How does their body show emotion? Not 'she felt sad' — what does sad LOOK like on this person?"
    }
  ],
  "locations": [
    {
      "name": "...",
      "sensoryPalette": {
        "sounds": ["specific sounds, not generic"],
        "smells": ["specific smells"],
        "textures": ["what do hands touch here?"],
        "lightQuality": "What does the light do?",
        "prohibitedDefaults": ["generic sensory details to avoid for this location"]
      }
    }
  ],
  "suggestedTone": {
    "metaphoricDomains": ["where do this story's metaphors come from?"],
    "prohibitedDomains": ["what metaphoric territory is too generic for this story?"],
    "pacingNotes": "Fast? Slow? Variable?",
    "interiority": "How deep in characters' heads are we?"
  },
  "suggestedKillList": [
    "genre-appropriate banned phrases — the clichés this specific story must avoid"
  ]
}

Be ruthlessly specific. If the synopsis doesn't give you enough to be specific, make a strong opinionated choice and flag it as [ASSUMPTION] so the author can override.`;

  return {
    systemMessage,
    userMessage,
    temperature: 0.7,
    topP: 0.92,
    maxTokens: 16384,
    model: "claude-sonnet-4-6",
    outputSchema: bootstrapSchema,
  };
}

// ─── Parse Bootstrap Response ───────────────────────────

export interface ParsedBootstrap {
  characters: Array<{
    name: string;
    role: string;
    physicalDescription?: string;
    backstory?: string;
    voiceNotes?: string;
    emotionPhysicality?: string;
  }>;
  locations: Array<{
    name: string;
    sensoryPalette?: {
      sounds?: string[];
      smells?: string[];
      textures?: string[];
      lightQuality?: string;
      prohibitedDefaults?: string[];
    };
  }>;
  suggestedTone?: {
    metaphoricDomains?: string[];
    prohibitedDomains?: string[];
    pacingNotes?: string;
    interiority?: string;
  };
  suggestedKillList?: string[];
}

export function parseBootstrapResponse(response: string): ParsedBootstrap | { error: string; rawText: string } {
  // Try 1: direct parse
  try {
    return JSON.parse(response) as ParsedBootstrap;
  } catch {
    // continue
  }

  // Try 2: strip markdown code fences (closed)
  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]) as ParsedBootstrap;
    } catch {
      // continue
    }
  }

  // Try 2b: strip opening fence even if unclosed (LLM ran out of tokens)
  const stripped = response.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  if (stripped !== response) {
    try {
      return JSON.parse(stripped) as ParsedBootstrap;
    } catch {
      // continue — fall through to brace-depth counting on stripped text
    }
  }

  // Try 3: extract first {...} block by brace-depth counting
  const text = stripped !== response ? stripped : response;
  const startIdx = text.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(startIdx, i + 1)) as ParsedBootstrap;
        } catch {
          break;
        }
      }
    }
  }

  return { error: "Failed to parse bootstrap response as JSON", rawText: response };
}

// ─── Bootstrap → Bible ──────────────────────────────────

export function bootstrapToBible(parsed: ParsedBootstrap, projectId: string, sourcePrompt?: string): Bible {
  const characters = (parsed.characters || []).map((c) => ({
    id: generateId(),
    name: c.name,
    role: (c.role || "supporting") as "protagonist" | "antagonist" | "supporting" | "minor",
    physicalDescription: c.physicalDescription || null,
    backstory: c.backstory || null,
    selfNarrative: null,
    contradictions: null,
    voice: {
      sentenceLengthRange: null,
      vocabularyNotes: c.voiceNotes || null,
      verbalTics: [],
      metaphoricRegister: null,
      prohibitedLanguage: [],
      dialogueSamples: [], // Human must author these
    },
    behavior: c.emotionPhysicality
      ? {
          stressResponse: null,
          socialPosture: null,
          noticesFirst: null,
          lyingStyle: null,
          emotionPhysicality: c.emotionPhysicality,
        }
      : null,
  }));

  const locations = (parsed.locations || []).map((l) => ({
    id: generateId(),
    name: l.name,
    description: null,
    sensoryPalette: {
      sounds: l.sensoryPalette?.sounds || [],
      smells: l.sensoryPalette?.smells || [],
      textures: l.sensoryPalette?.textures || [],
      lightQuality: l.sensoryPalette?.lightQuality || null,
      atmosphere: null,
      prohibitedDefaults: l.sensoryPalette?.prohibitedDefaults || [],
    },
  }));

  const tone = parsed.suggestedTone;

  return {
    projectId,
    version: 1,
    characters,
    styleGuide: {
      metaphoricRegister: tone
        ? {
            approvedDomains: tone.metaphoricDomains || [],
            prohibitedDomains: tone.prohibitedDomains || [],
          }
        : null,
      vocabularyPreferences: [],
      sentenceArchitecture: null,
      paragraphPolicy: null,
      killList: (parsed.suggestedKillList || []).map((phrase) => ({
        pattern: phrase,
        type: "exact" as const,
      })),
      negativeExemplars: [],
      positiveExemplars: [],
      structuralBans: [],
    },
    narrativeRules: {
      pov: {
        default: "close-third",
        distance: "close",
        interiority:
          tone?.interiority === "stream"
            ? "stream"
            : tone?.interiority === "behavioral-only"
              ? "behavioral-only"
              : "filtered",
        reliability: "reliable",
      },
      subtextPolicy: null,
      expositionPolicy: null,
      sceneEndingPolicy: null,
      setups: [],
    },
    locations,
    createdAt: new Date().toISOString(),
    sourcePrompt: sourcePrompt ?? null,
  };
}
