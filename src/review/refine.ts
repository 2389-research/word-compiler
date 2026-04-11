import { checkKillList } from "../auditor/index.js";
import type { Chunk, KillListEntry } from "../types/index.js";
import { getCanonicalText } from "../types/index.js";
import type { ChunkBoundary, ContinuousText, RefinementRequest, RefinementVariant } from "./refineTypes.js";
import type { ReviewContext } from "./types.js";

// ─── Continuous Text Builder ────────────────────

const CHUNK_SEPARATOR = "\n\n";

export function buildContinuousText(chunks: Chunk[]): ContinuousText {
  const boundaries: ChunkBoundary[] = [];
  let offset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const text = getCanonicalText(chunk);

    if (i > 0) {
      offset += CHUNK_SEPARATOR.length;
    }

    boundaries.push({
      chunkIndex: i,
      chunkId: chunk.id,
      startOffset: offset,
      endOffset: offset + text.length,
    });

    offset += text.length;
  }

  const text = chunks.map((c) => getCanonicalText(c)).join(CHUNK_SEPARATOR);
  return { text, boundaries };
}

export function findChunksForRange(start: number, end: number, boundaries: ChunkBoundary[]): ChunkBoundary[] {
  return boundaries.filter((b) => b.startOffset < end && b.endOffset > start);
}

// ─── Prompt Builder ─────────────────────────────

export function buildRefinementSystemPrompt(context: ReviewContext): string {
  const sections: string[] = [
    "You are a surgical prose editor for essays and nonfiction.",
    "CORE PRINCIPLE: MINIMAL INTERVENTION. Change only what the writer's complaint requires. Preserve surrounding rhythm, syntax, and voice.",
    "PRIORITY ORDER: Voice rules > Argumentative coherence > Rhythm > Grammar.",
  ];

  if (context.activeVoices.length > 0) {
    const voices = context.activeVoices.map((v) => `${v.name}: ${v.fingerprint}`).join("\n");
    sections.push(`AUTHOR VOICES (active in section):\n${voices}`);
  }

  if (context.styleRules.killList.length > 0) {
    const items = context.styleRules.killList.map((k) => k.pattern).join(", ");
    sections.push(`KILL LIST (ACTIVE — never use these in replacement text): ${items}`);
  }

  if (context.povRules) {
    sections.push(
      `POV RULES: Distance=${context.povRules.distance}, Interiority=${context.povRules.interiority}, Reliability=${context.povRules.reliability}`,
    );
  }

  if (context.subtextPolicy) {
    sections.push(`SUBTEXT POLICY: ${context.subtextPolicy}`);
  }

  sections.push(
    "OUTPUT: Return exactly 3 replacement variants as JSON. Each variant replaces ONLY the marked selection. If surrounding sentences need minor adjustment for flow, include adjustedBefore/adjustedAfter fields.",
  );

  return sections.join("\n\n");
}

export function buildRefinementUserPrompt(
  sceneText: string,
  request: RefinementRequest,
  sceneTitle: string,
  sceneGoal: string,
): string {
  const marked = [
    sceneText.slice(0, request.selectionStart),
    "<<SELECTION_START>>",
    request.selectedText,
    "<<SELECTION_END>>",
    sceneText.slice(request.selectionEnd),
  ].join("");

  const parts: string[] = [`SCENE: ${sceneTitle}`, `GOAL: ${sceneGoal}`, "", "FULL TEXT:", marked, ""];

  if (request.chips.length > 0) {
    const chipLabels = request.chips.join(", ");
    parts.push(`WRITER'S COMPLAINT: [${chipLabels}]`);
  }

  if (request.instruction.trim()) {
    parts.push(`WRITER'S NOTE: ${request.instruction.trim()}`);
  }

  parts.push("", "Replace the marked selection with 3 drop-in variants. Minimal intervention.");

  return parts.join("\n");
}

// ─── Output Schema ──────────────────────────────

export const REFINEMENT_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          rationale: { type: "string" },
          adjustedBefore: { anyOf: [{ type: "string" }, { type: "null" }] },
          adjustedAfter: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["text", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
};

// ─── Response Parser ────────────────────────────

export interface ParseRefinementResult {
  variants: RefinementVariant[];
  parseError?: string;
}

interface RawVariant {
  text?: string;
  rationale?: string;
  adjustedBefore?: string | null;
  adjustedAfter?: string | null;
}

export function parseRefinementResponse(raw: string, killList: KillListEntry[]): ParseRefinementResult {
  let parsed: { variants?: RawVariant[] };
  try {
    parsed = JSON.parse(raw) as { variants?: RawVariant[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[parseRefinementResponse] JSON parse failed:", msg);
    return { variants: [], parseError: `JSON parse failed: ${msg}` };
  }

  if (!Array.isArray(parsed.variants)) {
    return { variants: [], parseError: "Response missing 'variants' array" };
  }

  const variants = parsed.variants
    .filter(
      (v): v is RawVariant & { text: string; rationale: string } =>
        typeof v.text === "string" && typeof v.rationale === "string",
    )
    .map((v) => {
      const violations = checkKillList(v.text, killList, "").map((f) => f.message);
      return {
        text: v.text,
        rationale: v.rationale,
        adjustedBefore: v.adjustedBefore ?? undefined,
        adjustedAfter: v.adjustedAfter ?? undefined,
        killListClean: violations.length === 0,
        killListViolations: violations,
      };
    });

  return { variants };
}
