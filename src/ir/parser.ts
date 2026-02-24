import { extractJsonFromText } from "../bootstrap/index.js";
import type { NarrativeIR } from "../types/index.js";

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
  return v.map((x) => {
    if (typeof x === "string") return x;
    if (x && typeof x === "object") return JSON.stringify(x);
    return String(x);
  });
}

function coerceArrayPositions(v: unknown[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of v) {
    if (item && typeof item === "object" && "characterId" in item) {
      const entry = item as { characterId: string; position?: string };
      result[entry.characterId] = typeof entry.position === "string" ? entry.position : "";
    }
  }
  return result;
}

function coerceCharacterPositions(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  // New format: array of { characterId, position }
  if (Array.isArray(v)) return coerceArrayPositions(v);
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
  const ir: NarrativeIR = {
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
  // Guard against valid JSON that doesn't match the IR schema at all
  const hasContent =
    ir.events.length > 0 ||
    ir.factsIntroduced.length > 0 ||
    ir.characterDeltas.length > 0 ||
    ir.unresolvedTensions.length > 0;
  if (!hasContent) {
    throw new Error(
      "IR extraction returned JSON with no recognizable content — the response may not match the expected schema",
    );
  }
  return ir;
}

// ─── 3-Tier Parser (delegates JSON extraction to bootstrap) ──────────

export function parseIRResponse(text: string, sceneId: string): NarrativeIR {
  const parsed = extractJsonFromText(text);
  if (parsed === null) {
    throw new Error(`IR extraction returned unparseable response: ${text.slice(0, 200)}`);
  }
  return rawToNarrativeIR(parsed as RawIR, sceneId);
}

// Re-export for convenience
export { isStringArray };
