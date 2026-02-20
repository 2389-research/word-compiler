import type { NarrativeIR } from "../types/index.js";
import { createEmptyNarrativeIR } from "../types/index.js";

// ─── Raw IR shape from LLM ───────────────────────────────

interface RawIR {
  events?: unknown[];
  factsIntroduced?: unknown[];
  factsRevealedToReader?: unknown[];
  factsWithheld?: unknown[];
  characterDeltas?: unknown[];
  setupsPlanted?: unknown[];
  payoffsExecuted?: unknown[];
  characterPositions?: unknown;
  unresolvedTensions?: unknown[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x)));
}

function coerceCharacterPositions(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  // New format: array of { characterId, position }
  if (Array.isArray(v)) {
    const result: Record<string, string> = {};
    for (const item of v) {
      if (item && typeof item === "object" && "characterId" in item) {
        const entry = item as { characterId: string; position?: string };
        result[entry.characterId] = typeof entry.position === "string" ? entry.position : "";
      }
    }
    return result;
  }
  // Legacy format: { [characterId]: position }
  const result: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    result[k] = typeof val === "string" ? val : String(val);
  }
  return result;
}

function coerceCharacterDeltas(v: unknown): NarrativeIR["characterDeltas"] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    if (!item || typeof item !== "object")
      return { characterId: "", learned: null, suspicionGained: null, emotionalShift: null, relationshipChange: null };
    const i = item as Record<string, unknown>;
    return {
      characterId: typeof i.characterId === "string" ? i.characterId : String(i.characterId ?? ""),
      learned: typeof i.learned === "string" ? i.learned : null,
      suspicionGained: typeof i.suspicionGained === "string" ? i.suspicionGained : null,
      emotionalShift: typeof i.emotionalShift === "string" ? i.emotionalShift : null,
      relationshipChange: typeof i.relationshipChange === "string" ? i.relationshipChange : null,
    };
  });
}

function rawToNarrativeIR(raw: RawIR, sceneId: string): NarrativeIR {
  return {
    sceneId,
    verified: false,
    events: coerceStringArray(raw.events),
    factsIntroduced: coerceStringArray(raw.factsIntroduced),
    factsRevealedToReader: coerceStringArray(raw.factsRevealedToReader),
    factsWithheld: coerceStringArray(raw.factsWithheld),
    characterDeltas: coerceCharacterDeltas(raw.characterDeltas),
    setupsPlanted: coerceStringArray(raw.setupsPlanted),
    payoffsExecuted: coerceStringArray(raw.payoffsExecuted),
    characterPositions: coerceCharacterPositions(raw.characterPositions),
    unresolvedTensions: coerceStringArray(raw.unresolvedTensions),
  };
}

// ─── 3-Tier Parser (mirrors bootstrap strategy) ──────────

export function parseIRResponse(text: string, sceneId: string): NarrativeIR {
  // Tier 1: direct JSON parse
  try {
    const parsed = JSON.parse(text) as RawIR;
    return rawToNarrativeIR(parsed, sceneId);
  } catch {
    // continue
  }

  // Tier 2: strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1]) as RawIR;
      return rawToNarrativeIR(parsed, sceneId);
    } catch {
      // continue
    }
  }

  // Tier 3: brace-depth extraction of first {...} block
  const startIdx = text.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(startIdx, i + 1)) as RawIR;
          return rawToNarrativeIR(parsed, sceneId);
        } catch {
          break;
        }
      }
    }
  }

  // Fallback: empty IR (extraction failed — human must fill in)
  return createEmptyNarrativeIR(sceneId);
}

// Re-export for convenience
export { isStringArray };
