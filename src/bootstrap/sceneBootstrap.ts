import type { CompiledPayload, ScenePlan } from "../types/index.js";
import { createEmptyScenePlan, generateId } from "../types/index.js";
import { extractJsonFromText } from "./index.js";

// ─── Types ─────────────────────────────────────────────

export interface ExistingSceneSummary {
  title: string;
  povCharacterName: string;
  povDistance: string;
  narrativeGoal: string;
  emotionalBeat: string;
  readerStateExiting: {
    knows: string[];
    suspects: string[];
    wrongAbout: string[];
    activeTensions: string[];
  } | null;
}

export interface BootstrapChapterArc {
  workingTitle: string;
  narrativeFunction: string;
  dominantRegister: string;
  pacingTarget: string;
  endingPosture: string;
}

export interface BootstrapNarrativeRules {
  pov: {
    default: string;
    distance: string;
    interiority: string;
    reliability: string;
    notes?: string;
  };
  subtextPolicy: string | null;
  expositionPolicy: string | null;
  sceneEndingPolicy: string | null;
}

export interface BootstrapCharacterDossier {
  name: string;
  role: string;
  backstory: string | null;
  contradictions: string[] | null;
  voice: {
    vocabularyNotes: string | null;
    verbalTics: string[];
    prohibitedLanguage: string[];
    metaphoricRegister: string | null;
  };
  behavior: {
    stressResponse: string | null;
    noticesFirst: string | null;
    emotionPhysicality: string | null;
  } | null;
}

export interface BootstrapLocationDetail {
  name: string;
  description: string | null;
  atmosphere: string | null;
  sounds: string[];
  smells: string[];
  prohibitedDefaults: string[];
}

export interface BootstrapActiveSetup {
  description: string;
  status: string;
}

export interface SceneBootstrapParams {
  direction: string;
  sceneCount: number;
  characters: { id: string; name: string; role: string }[];
  locations: { id: string; name: string }[];
  constraints?: string;
  includeChapterArc: boolean;
  // Optional rich context
  existingScenes?: ExistingSceneSummary[];
  chapterArc?: BootstrapChapterArc;
  narrativeRules?: BootstrapNarrativeRules;
  activeSetups?: BootstrapActiveSetup[];
  characterDossiers?: BootstrapCharacterDossier[];
  locationDetails?: BootstrapLocationDetail[];
  killList?: string[];
  structuralBans?: string[];
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

// ─── Condensation Helpers ─────────────────────────────

function formatReaderStateExit(exit: NonNullable<ExistingSceneSummary["readerStateExiting"]>): string | null {
  const items: string[] = [];
  if (exit.knows.length > 0) items.push(`knows: ${exit.knows.join("; ")}`);
  if (exit.suspects.length > 0) items.push(`suspects: ${exit.suspects.join("; ")}`);
  if (exit.wrongAbout.length > 0) items.push(`wrong about: ${exit.wrongAbout.join("; ")}`);
  if (exit.activeTensions.length > 0) items.push(`tensions: ${exit.activeTensions.join("; ")}`);
  return items.length > 0 ? items.join(" | ") : null;
}

export function condensedExistingScenes(scenes: ExistingSceneSummary[] | undefined): string {
  if (!scenes || scenes.length === 0) return "";
  return scenes
    .map((s, i) => {
      const parts = [`${i + 1}. "${s.title}" — POV: ${s.povCharacterName} (${s.povDistance})`];
      if (s.narrativeGoal) parts.push(`   Goal: ${s.narrativeGoal}`);
      if (s.emotionalBeat) parts.push(`   Beat: ${s.emotionalBeat}`);
      if (s.readerStateExiting) {
        const formatted = formatReaderStateExit(s.readerStateExiting);
        if (formatted) parts.push(`   Reader exits: ${formatted}`);
      }
      return parts.join("\n");
    })
    .join("\n");
}

function formatCharVoice(voice: BootstrapCharacterDossier["voice"]): string | null {
  const parts: string[] = [];
  if (voice.vocabularyNotes) parts.push(voice.vocabularyNotes);
  if (voice.verbalTics.length > 0) parts.push(`tics: ${voice.verbalTics.join(", ")}`);
  if (voice.prohibitedLanguage.length > 0) parts.push(`never says: ${voice.prohibitedLanguage.join(", ")}`);
  if (voice.metaphoricRegister) parts.push(`metaphor register: ${voice.metaphoricRegister}`);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function formatCharBehavior(behavior: NonNullable<BootstrapCharacterDossier["behavior"]>): string | null {
  const parts: string[] = [];
  if (behavior.stressResponse) parts.push(`stress: ${behavior.stressResponse}`);
  if (behavior.noticesFirst) parts.push(`notices first: ${behavior.noticesFirst}`);
  if (behavior.emotionPhysicality) parts.push(`emotion: ${behavior.emotionPhysicality}`);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function condensedCharacterDossiers(dossiers: BootstrapCharacterDossier[] | undefined): string {
  if (!dossiers || dossiers.length === 0) return "";
  return dossiers
    .map((c) => {
      const parts = [`- ${c.name} (${c.role})`];
      if (c.backstory) parts.push(`  Backstory: ${c.backstory}`);
      if (c.contradictions && c.contradictions.length > 0)
        parts.push(`  Contradictions: ${c.contradictions.join("; ")}`);
      const voiceStr = formatCharVoice(c.voice);
      if (voiceStr) parts.push(`  Voice: ${voiceStr}`);
      if (c.behavior) {
        const behaviorStr = formatCharBehavior(c.behavior);
        if (behaviorStr) parts.push(`  Behavior: ${behaviorStr}`);
      }
      return parts.join("\n");
    })
    .join("\n");
}

export function condensedLocationDetails(locations: BootstrapLocationDetail[] | undefined): string {
  if (!locations || locations.length === 0) return "";
  return locations
    .map((l) => {
      const parts = [`- ${l.name}`];
      if (l.description) parts.push(`  ${l.description}`);
      if (l.atmosphere) parts.push(`  Atmosphere: ${l.atmosphere}`);
      const sensory: string[] = [];
      if (l.sounds.length > 0) sensory.push(`sounds: ${l.sounds.join(", ")}`);
      if (l.smells.length > 0) sensory.push(`smells: ${l.smells.join(", ")}`);
      if (sensory.length > 0) parts.push(`  Senses: ${sensory.join(" | ")}`);
      if (l.prohibitedDefaults.length > 0) parts.push(`  Avoid: ${l.prohibitedDefaults.join(", ")}`);
      return parts.join("\n");
    })
    .join("\n");
}

export function condensedNarrativeRules(rules: BootstrapNarrativeRules | undefined): string {
  if (!rules) return "";
  const parts: string[] = [];
  const pov = rules.pov;
  parts.push(
    `POV CONTRACT: ${pov.default} person, ${pov.distance} distance, ${pov.interiority} interiority, ${pov.reliability} narrator.`,
  );
  if (pov.notes) parts.push(`POV notes: ${pov.notes}`);
  if (rules.subtextPolicy) parts.push(`SUBTEXT POLICY: ${rules.subtextPolicy}`);
  if (rules.expositionPolicy) parts.push(`EXPOSITION POLICY: ${rules.expositionPolicy}`);
  if (rules.sceneEndingPolicy) parts.push(`SCENE ENDING POLICY: ${rules.sceneEndingPolicy}`);
  return parts.join("\n");
}

export function condensedKillListAndBans(killList: string[] | undefined, structuralBans: string[] | undefined): string {
  const parts: string[] = [];
  if (killList && killList.length > 0) {
    parts.push(`NEVER USE these words/phrases: ${killList.join(", ")}`);
  }
  if (structuralBans && structuralBans.length > 0) {
    parts.push(`STRUCTURAL RULES: ${structuralBans.join("; ")}`);
  }
  return parts.join("\n");
}

function buildContextBlocks(params: SceneBootstrapParams): string[] {
  const blocks: string[] = [];

  if (params.chapterArc) {
    const a = params.chapterArc;
    blocks.push(
      `ESTABLISHED CHAPTER ARC:\nTitle: ${a.workingTitle}\nFunction: ${a.narrativeFunction}\nRegister: ${a.dominantRegister}\nPacing: ${a.pacingTarget}\nEnding: ${a.endingPosture}`,
    );
  }

  const scenesBlock = condensedExistingScenes(params.existingScenes);
  if (scenesBlock) {
    blocks.push(`EXISTING SCENES (do not contradict or duplicate):\n${scenesBlock}`);
  }

  const dossiersBlock = condensedCharacterDossiers(params.characterDossiers);
  if (dossiersBlock) {
    blocks.push(`CHARACTER DOSSIERS:\n${dossiersBlock}`);
  }

  const locsBlock = condensedLocationDetails(params.locationDetails);
  if (locsBlock) {
    blocks.push(`LOCATION DETAILS:\n${locsBlock}`);
  }

  if (params.activeSetups && params.activeSetups.length > 0) {
    const setupLines = params.activeSetups.map((s) => `- [${s.status}] ${s.description}`).join("\n");
    blocks.push(`ACTIVE SETUPS:\n${setupLines}`);
  }

  return blocks;
}

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

  // Build system message with optional narrative rules and kill list
  const systemParts = [
    `You are a narrative architect. Given direction for a chapter, generate ${params.sceneCount} scene plans that form a cohesive chapter arc. Each scene must maintain continuity — the readerStateExiting of scene N should inform the readerStateEntering of scene N+1. Be specific and opinionated.`,
  ];
  const rulesBlock = condensedNarrativeRules(params.narrativeRules);
  if (rulesBlock) systemParts.push("", rulesBlock);
  const bansBlock = condensedKillListAndBans(params.killList, params.structuralBans);
  if (bansBlock) systemParts.push("", bansBlock);
  const systemMessage = systemParts.join("\n");

  const contextBlocks = buildContextBlocks(params);
  const contextSection = contextBlocks.length > 0 ? `\n\n${contextBlocks.join("\n\n")}\n` : "";

  // Continuity note when appending to existing scenes
  const existingCount = params.existingScenes?.length ?? 0;
  const continuityNote =
    existingCount > 0
      ? `\nYou are generating scenes ${existingCount + 1} through ${existingCount + params.sceneCount}. New scenes must continue seamlessly from existing ones.`
      : "";

  const userMessage = `CHAPTER DIRECTION:
${params.direction}${contextSection}

Generate exactly ${params.sceneCount} scene plans.${characterList}${locationList}${constraintBlock}${params.characters.length === 0 ? "\nIMPORTANT: No characters have been selected for this chapter. Leave povCharacterId and povCharacterName as empty strings. Do NOT invent or reference specific named characters — write scenes that work without assigned POV characters." : ""}

Return JSON:
{
  "scenes": [
    {
      "title": "Scene title",
      ${
        params.characters.length > 0
          ? `"povCharacterId": "",
      "povCharacterName": "REQUIRED — exact character name from the list above (ID will be resolved automatically)",`
          : `"povCharacterId": "",
      "povCharacterName": "",`
      }
      "povDistance": "intimate|close|moderate|distant",
      "narrativeGoal": "What must this scene accomplish?",
      "emotionalBeat": "What should the reader FEEL?",
      "readerEffect": "What shifts in the reader's understanding?",
      "failureModeToAvoid": "What would make this scene fail?",
      "density": "sparse|moderate|dense",
      "pacing": "Pacing notes",
      "sensoryNotes": "Key sensory details to anchor the scene",
      "locationId": "",
      "locationName": "exact location name from the list above, or empty string if none (ID will be resolved automatically)",
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

CRITICAL: Maintain reader state continuity across scenes. Scene 2's readerStateEntering must build on Scene 1's readerStateExiting.${chapterArcInstruction}${continuityNote}`;

  return {
    systemMessage,
    userMessage,
    temperature: 0.7,
    topP: 0.92,
    maxTokens: 8000,
    model: "claude-sonnet-4-6",
  };
}

// ─── Response Parser ───────────────────────────────────

export function parseSceneBootstrapResponse(
  response: string,
): ParsedSceneBootstrap | { error: string; rawText: string } {
  const result = extractJsonFromText(response);
  if (result !== null) return result as ParsedSceneBootstrap;
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

/** Tokenize a name into lowercase words for fuzzy matching. */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((t) => t.length > 0);
}

/** Score how well two names match by token overlap (0 to 1). */
export function tokenMatchScore(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setB = new Set(tokensB);
  const matches = tokensA.filter((t) => setB.has(t)).length;
  return matches / Math.max(tokensA.length, tokensB.length);
}

/** Find the best fuzzy token match among named entities. Returns the ID if score >= threshold. */
function fuzzyMatchId(raw: string, entities: { id: string; name: string }[], threshold = 0.5): string {
  let bestScore = 0;
  let bestId = "";
  for (const e of entities) {
    const score = tokenMatchScore(raw, e.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = e.id;
    }
  }
  return bestScore >= threshold ? bestId : "";
}

/** Resolve a character ID by trying exact ID, exact name, then fuzzy name match.
 *  Returns the raw name/ID as-is when resolution fails, so the UI can surface it as unresolved. */
export function resolveCharacterId(
  rawId: string | undefined,
  rawName: string | undefined,
  characters: { id: string; name: string }[],
): string {
  const id = rawId || "";
  const nameLower = (rawName || "").toLowerCase();

  // 1. Exact ID match
  if (id && characters.some((c) => c.id === id)) return id;

  // 2. Exact name match (case-insensitive)
  if (nameLower) {
    const byName = characters.find((c) => c.name.toLowerCase() === nameLower);
    if (byName) return byName.id;
  }

  // 3. Fuzzy token match — try name first, fall back to ID as slug
  const rawForFuzzy = rawName || rawId || "";
  if (rawForFuzzy && characters.length > 0) {
    const matched = fuzzyMatchId(rawForFuzzy, characters);
    if (matched) return matched;
  }

  // 4. Preserve raw reference so resolution UI can surface it
  return rawName || rawId || "";
}

/** Resolve a location ID by trying exact ID, exact name, then fuzzy name match.
 *  Returns the raw name/ID as-is when resolution fails, so the UI can surface it as unresolved.
 *  Returns null only when no location was specified at all. */
export function resolveLocationId(
  rawId: string | undefined,
  rawName: string | undefined,
  locations: { id: string; name: string }[],
): string | null {
  const id = rawId || null;
  const nameLower = (rawName || "").toLowerCase();

  // 1. Exact ID match
  if (id && locations.some((l) => l.id === id)) return id;

  // 2. Exact name match (case-insensitive)
  if (nameLower) {
    const byName = locations.find((l) => l.name.toLowerCase() === nameLower);
    if (byName) return byName.id;
  }

  // 3. Fuzzy token match
  const rawForFuzzy = rawName || rawId || "";
  if (rawForFuzzy && locations.length > 0) {
    const matched = fuzzyMatchId(rawForFuzzy, locations);
    if (matched) return matched;
  }

  // 4. Preserve raw reference so resolution UI can surface it
  return rawName || rawId || null;
}

/** Normalize a raw word count (array or single number) into a [min, max] tuple. */
function normalizeWordCount(raw: [number, number] | number | undefined, base: [number, number]): [number, number] {
  if (Array.isArray(raw) && raw.length >= 2) {
    return [raw[0]!, raw[1]!];
  }
  if (typeof raw === "number") {
    return [Math.floor(raw * 0.8), Math.ceil(raw * 1.2)];
  }
  return base;
}

const VALID_DENSITIES = ["sparse", "moderate", "dense"];
const VALID_POV_DISTANCES = ["intimate", "close", "moderate", "distant"];

type RawScene = ParsedSceneBootstrap["scenes"][number];

/** Validate a raw enum string against an allow list, returning the fallback if invalid. */
function validateEnum<T extends string>(raw: string | undefined, valid: string[], fallback: T): T {
  return (valid.includes(raw || "") ? raw : fallback) as T;
}

/** Normalize raw subtext into the ScenePlan shape. */
function normalizeSubtext(raw: RawScene["subtext"], fallback: ScenePlan["subtext"]): ScenePlan["subtext"] {
  if (!raw) return fallback;
  return {
    surfaceConversation: raw.surfaceConversation || "",
    actualConversation: raw.actualConversation || "",
    enforcementRule: raw.enforcementRule || "",
  };
}

/** Normalize raw anchor lines into the ScenePlan shape. */
function normalizeAnchorLines(raw: RawScene["anchorLines"]): ScenePlan["anchorLines"] {
  return (raw || []).map((a) => ({
    text: a.text || "",
    placement: a.placement || "",
    verbatim: a.verbatim ?? true,
  }));
}

/** Map a single raw parsed scene to a ScenePlan, resolving IDs and normalizing values. */
function mapRawScene(
  raw: RawScene,
  base: ScenePlan,
  characters: { id: string; name: string }[],
  locations: { id: string; name: string }[],
): ScenePlan {
  return {
    ...base,
    id: generateId(),
    title: raw.title || base.title,
    povCharacterId: resolveCharacterId(raw.povCharacterId, raw.povCharacterName, characters),
    povDistance: validateEnum(raw.povDistance, VALID_POV_DISTANCES, base.povDistance),
    narrativeGoal: raw.narrativeGoal || base.narrativeGoal,
    emotionalBeat: raw.emotionalBeat || base.emotionalBeat,
    readerEffect: raw.readerEffect || base.readerEffect,
    failureModeToAvoid: raw.failureModeToAvoid || base.failureModeToAvoid,
    density: validateEnum(raw.density, VALID_DENSITIES, base.density),
    pacing: raw.pacing || base.pacing,
    sensoryNotes: raw.sensoryNotes || base.sensoryNotes,
    locationId: resolveLocationId(raw.locationId, raw.locationName, locations),
    estimatedWordCount: normalizeWordCount(raw.estimatedWordCount, base.estimatedWordCount),
    chunkCount: raw.chunkCount || base.chunkCount,
    chunkDescriptions: raw.chunkDescriptions || base.chunkDescriptions,
    readerStateEntering: resolveReaderState(raw.readerStateEntering),
    readerStateExiting: resolveReaderState(raw.readerStateExiting),
    subtext: normalizeSubtext(raw.subtext, base.subtext),
    sceneSpecificProhibitions: raw.sceneSpecificProhibitions || base.sceneSpecificProhibitions,
    anchorLines: normalizeAnchorLines(raw.anchorLines),
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
    return mapRawScene(raw, base, characters, locations);
  });
}
