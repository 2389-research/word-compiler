import type { CompiledPayload, ScenePlan } from "../types/index.js";
import { createEmptyScenePlan, generateId } from "../types/index.js";

// ─── Types ─────────────────────────────────────────────

export interface SceneBootstrapParams {
  direction: string;
  sceneCount: number;
  characters: { id: string; name: string; role: string }[];
  locations: { id: string; name: string }[];
  constraints?: string;
  includeChapterArc: boolean;
}

export interface ParsedSceneBootstrap {
  scenes: Array<{
    title?: string;
    povCharacterId?: string;
    povCharacterName?: string;
    povDistance?: string;
    narrativeGoal?: string;
    emotionalBeat?: string;
    readerEffect?: string;
    failureModeToAvoid?: string;
    density?: string;
    pacing?: string;
    sensoryNotes?: string;
    locationId?: string;
    locationName?: string;
    estimatedWordCount?: [number, number] | number;
    chunkCount?: number;
    chunkDescriptions?: string[];
    readerStateEntering?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
    readerStateExiting?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
    subtext?: {
      surfaceConversation?: string;
      actualConversation?: string;
      enforcementRule?: string;
    };
    sceneSpecificProhibitions?: string[];
    anchorLines?: Array<{
      text?: string;
      placement?: string;
      verbatim?: boolean;
    }>;
  }>;
  chapterArc?: {
    workingTitle?: string;
    narrativeFunction?: string;
    dominantRegister?: string;
    pacingTarget?: string;
    endingPosture?: string;
    readerStateEntering?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
    readerStateExiting?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
  };
}

// ─── Prompt Builder ────────────────────────────────────

const readerStateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    knows: { type: "array", items: { type: "string" } },
    suspects: { type: "array", items: { type: "string" } },
    wrongAbout: { type: "array", items: { type: "string" } },
    activeTensions: { type: "array", items: { type: "string" } },
  },
  required: ["knows", "suspects", "wrongAbout", "activeTensions"],
};

export const sceneBootstrapSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          povCharacterId: { type: "string" },
          povCharacterName: { type: "string" },
          povDistance: { type: "string" },
          narrativeGoal: { type: "string" },
          emotionalBeat: { type: "string" },
          readerEffect: { type: "string" },
          failureModeToAvoid: { type: "string" },
          density: { type: "string" },
          pacing: { type: "string" },
          sensoryNotes: { type: "string" },
          locationId: { type: "string" },
          locationName: { type: "string" },
          estimatedWordCount: { type: "array", items: { type: "number" } },
          chunkCount: { type: "number" },
          chunkDescriptions: { type: "array", items: { type: "string" } },
          readerStateEntering: readerStateSchema,
          readerStateExiting: readerStateSchema,
          subtext: {
            type: "object",
            additionalProperties: false,
            properties: {
              surfaceConversation: { type: "string" },
              actualConversation: { type: "string" },
              enforcementRule: { type: "string" },
            },
            required: ["surfaceConversation", "actualConversation", "enforcementRule"],
          },
          sceneSpecificProhibitions: { type: "array", items: { type: "string" } },
          anchorLines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                placement: { type: "string" },
                verbatim: { type: "boolean" },
              },
              required: ["text", "placement", "verbatim"],
            },
          },
        },
        required: [
          "title",
          "povCharacterId",
          "povCharacterName",
          "povDistance",
          "narrativeGoal",
          "emotionalBeat",
          "readerEffect",
          "failureModeToAvoid",
          "density",
          "pacing",
          "sensoryNotes",
          "locationId",
          "locationName",
          "estimatedWordCount",
          "chunkCount",
          "chunkDescriptions",
          "readerStateEntering",
          "readerStateExiting",
          "subtext",
          "sceneSpecificProhibitions",
          "anchorLines",
        ],
      },
    },
    chapterArc: {
      type: "object",
      additionalProperties: false,
      properties: {
        workingTitle: { type: "string" },
        narrativeFunction: { type: "string" },
        dominantRegister: { type: "string" },
        pacingTarget: { type: "string" },
        endingPosture: { type: "string" },
        readerStateEntering: readerStateSchema,
        readerStateExiting: readerStateSchema,
      },
      required: [
        "workingTitle",
        "narrativeFunction",
        "dominantRegister",
        "pacingTarget",
        "endingPosture",
        "readerStateEntering",
        "readerStateExiting",
      ],
    },
  },
  required: ["scenes", "chapterArc"],
};

export function buildSceneBootstrapPrompt(params: SceneBootstrapParams): CompiledPayload {
  const characterList =
    params.characters.length > 0
      ? `\nAvailable characters:\n${params.characters.map((c) => `- ${c.name} (id: "${c.id}", role: ${c.role})`).join("\n")}`
      : "";

  const locationList =
    params.locations.length > 0
      ? `\nAvailable locations:\n${params.locations.map((l) => `- ${l.name} (id: "${l.id}")`).join("\n")}`
      : "";

  const constraintBlock = params.constraints ? `\nAdditional constraints:\n${params.constraints}` : "";

  const chapterArcInstruction = params.includeChapterArc
    ? `\nAlso include a "chapterArc" field with: workingTitle, narrativeFunction, dominantRegister, pacingTarget, endingPosture, readerStateEntering, readerStateExiting.`
    : "";

  const systemMessage = `You are a narrative architect. Given direction for a chapter, generate ${params.sceneCount} scene plans that form a cohesive chapter arc. Each scene must maintain continuity — the readerStateExiting of scene N should inform the readerStateEntering of scene N+1. Be specific and opinionated.`;

  const userMessage = `CHAPTER DIRECTION:
${params.direction}

Generate exactly ${params.sceneCount} scene plans.${characterList}${locationList}${constraintBlock}

Return JSON:
{
  "scenes": [
    {
      "title": "Scene title",
      "povCharacterId": "character id from list above, or empty string",
      "povCharacterName": "character name for reference",
      "povDistance": "intimate|close|moderate|distant",
      "narrativeGoal": "What must this scene accomplish?",
      "emotionalBeat": "What should the reader FEEL?",
      "readerEffect": "What shifts in the reader's understanding?",
      "failureModeToAvoid": "What would make this scene fail?",
      "density": "sparse|moderate|dense",
      "pacing": "Pacing notes",
      "sensoryNotes": "Key sensory details to anchor the scene",
      "locationId": "location id from list above, or null",
      "locationName": "location name for reference",
      "estimatedWordCount": [min, max],
      "chunkCount": 3,
      "chunkDescriptions": ["what happens in chunk 1", "chunk 2", "chunk 3"],
      "readerStateEntering": {
        "knows": ["what the reader knows going in"],
        "suspects": ["what the reader suspects"],
        "wrongAbout": ["what the reader is wrong about"],
        "activeTensions": ["unresolved tensions"]
      },
      "readerStateExiting": {
        "knows": ["what the reader knows after"],
        "suspects": ["new suspicions"],
        "wrongAbout": ["remaining misconceptions"],
        "activeTensions": ["new or continuing tensions"]
      },
      "subtext": {
        "surfaceConversation": "What characters appear to discuss",
        "actualConversation": "What's really being communicated",
        "enforcementRule": "How to maintain the gap"
      },
      "sceneSpecificProhibitions": ["things to avoid in this specific scene"],
      "anchorLines": [
        { "text": "A line that must appear", "placement": "where in the scene", "verbatim": true }
      ]
    }
  ]${
    params.includeChapterArc
      ? `,
  "chapterArc": {
    "workingTitle": "Chapter working title",
    "narrativeFunction": "What this chapter accomplishes in the larger story",
    "dominantRegister": "The tonal register",
    "pacingTarget": "Overall pacing description",
    "endingPosture": "How the chapter should end",
    "readerStateEntering": { "knows": [], "suspects": [], "wrongAbout": [], "activeTensions": [] },
    "readerStateExiting": { "knows": [], "suspects": [], "wrongAbout": [], "activeTensions": [] }
  }`
      : ""
  }
}

CRITICAL: Maintain reader state continuity across scenes. Scene 2's readerStateEntering must build on Scene 1's readerStateExiting.${chapterArcInstruction}`;

  return {
    systemMessage,
    userMessage,
    temperature: 0.7,
    topP: 0.92,
    maxTokens: 8000,
    model: "claude-sonnet-4-6",
    outputSchema: sceneBootstrapSchema,
  };
}

// ─── Response Parser ───────────────────────────────────

export function parseSceneBootstrapResponse(
  response: string,
): ParsedSceneBootstrap | { error: string; rawText: string } {
  // Try 1: direct parse
  try {
    return JSON.parse(response) as ParsedSceneBootstrap;
  } catch {
    // continue
  }

  // Try 2: strip markdown code fences
  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]) as ParsedSceneBootstrap;
    } catch {
      // continue
    }
  }

  // Try 3: extract first {...} block by brace-depth counting
  const startIdx = response.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    for (let i = startIdx; i < response.length; i++) {
      if (response[i] === "{") depth++;
      if (response[i] === "}") depth--;
      if (depth === 0) {
        try {
          return JSON.parse(response.slice(startIdx, i + 1)) as ParsedSceneBootstrap;
        } catch {
          break;
        }
      }
    }
  }

  return { error: "Failed to parse scene bootstrap response as JSON", rawText: response };
}

// ─── Mapper ────────────────────────────────────────────

function resolveReaderState(raw?: {
  knows?: string[];
  suspects?: string[];
  wrongAbout?: string[];
  activeTensions?: string[];
}) {
  if (!raw) return null;
  return {
    knows: raw.knows ?? [],
    suspects: raw.suspects ?? [],
    wrongAbout: raw.wrongAbout ?? [],
    activeTensions: raw.activeTensions ?? [],
  };
}

export function mapSceneBootstrapToPlans(
  parsed: ParsedSceneBootstrap,
  projectId: string,
  characters: { id: string; name: string }[],
  locations: { id: string; name: string }[],
): ScenePlan[] {
  return (parsed.scenes || []).map((raw) => {
    const base = createEmptyScenePlan(projectId);

    // Resolve character by name if ID not directly matched
    let povCharacterId = raw.povCharacterId || "";
    if (povCharacterId && !characters.some((c) => c.id === povCharacterId)) {
      const byName = characters.find((c) => c.name.toLowerCase() === (raw.povCharacterName || "").toLowerCase());
      if (byName) povCharacterId = byName.id;
    }
    if (!povCharacterId && raw.povCharacterName) {
      const byName = characters.find((c) => c.name.toLowerCase() === raw.povCharacterName!.toLowerCase());
      if (byName) povCharacterId = byName.id;
    }

    // Resolve location by name if ID not matched
    let locationId = raw.locationId || null;
    if (locationId && !locations.some((l) => l.id === locationId)) {
      const byName = locations.find((l) => l.name.toLowerCase() === (raw.locationName || "").toLowerCase());
      locationId = byName?.id ?? null;
    }
    if (!locationId && raw.locationName) {
      const byName = locations.find((l) => l.name.toLowerCase() === raw.locationName!.toLowerCase());
      locationId = byName?.id ?? null;
    }

    // Normalize estimated word count
    let estimatedWordCount: [number, number] = base.estimatedWordCount;
    if (Array.isArray(raw.estimatedWordCount) && raw.estimatedWordCount.length >= 2) {
      estimatedWordCount = [raw.estimatedWordCount[0]!, raw.estimatedWordCount[1]!];
    } else if (typeof raw.estimatedWordCount === "number") {
      estimatedWordCount = [Math.floor(raw.estimatedWordCount * 0.8), Math.ceil(raw.estimatedWordCount * 1.2)];
    }

    const density = (["sparse", "moderate", "dense"].includes(raw.density || "") ? raw.density : base.density) as
      | "sparse"
      | "moderate"
      | "dense";

    const povDistance = (
      ["intimate", "close", "moderate", "distant"].includes(raw.povDistance || "") ? raw.povDistance : base.povDistance
    ) as "intimate" | "close" | "moderate" | "distant";

    return {
      ...base,
      id: generateId(),
      title: raw.title || base.title,
      povCharacterId,
      povDistance,
      narrativeGoal: raw.narrativeGoal || base.narrativeGoal,
      emotionalBeat: raw.emotionalBeat || base.emotionalBeat,
      readerEffect: raw.readerEffect || base.readerEffect,
      failureModeToAvoid: raw.failureModeToAvoid || base.failureModeToAvoid,
      density,
      pacing: raw.pacing || base.pacing,
      sensoryNotes: raw.sensoryNotes || base.sensoryNotes,
      locationId,
      estimatedWordCount,
      chunkCount: raw.chunkCount || base.chunkCount,
      chunkDescriptions: raw.chunkDescriptions || base.chunkDescriptions,
      readerStateEntering: resolveReaderState(raw.readerStateEntering),
      readerStateExiting: resolveReaderState(raw.readerStateExiting),
      subtext: raw.subtext
        ? {
            surfaceConversation: raw.subtext.surfaceConversation || "",
            actualConversation: raw.subtext.actualConversation || "",
            enforcementRule: raw.subtext.enforcementRule || "",
          }
        : base.subtext,
      sceneSpecificProhibitions: raw.sceneSpecificProhibitions || base.sceneSpecificProhibitions,
      anchorLines: (raw.anchorLines || []).map((a) => ({
        text: a.text || "",
        placement: a.placement || "",
        verbatim: a.verbatim ?? true,
      })),
    };
  });
}
