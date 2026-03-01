import type { Bible } from "../types/bible.js";
import type { ScenePlan } from "../types/scene.js";
import { generateId } from "../types/utils.js";
import { resolveAnchor } from "./anchorResolver.js";
import { buildReviewContext } from "./contextBuilder.js";
import { hashFingerprint } from "./fingerprint.js";
import { runLocalChecks } from "./localChecks.js";
import { buildReviewSystemPrompt, buildReviewUserPrompt, REVIEW_OUTPUT_SCHEMA } from "./prompt.js";
import {
  ANNOTATION_SCOPES,
  type ChunkView,
  type EditorialAnnotation,
  LLM_REVIEW_CATEGORIES,
  type LLMReviewCategory,
  type ReviewOrchestrator,
  SEVERITIES,
  type Severity,
} from "./types.js";

export interface LLMReviewClient {
  review(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string>;
}

export function createReviewOrchestrator(
  bible: Bible,
  scenePlan: ScenePlan,
  getDismissed: () => Set<string>,
  llmClient: LLMReviewClient,
  onAnnotationsChanged: (chunkIndex: number, anns: EditorialAnnotation[]) => void,
): ReviewOrchestrator {
  let abortController: AbortController | null = null;
  const annotations = new Map<number, EditorialAnnotation[]>();
  const reviewing = new Set<number>();

  function requestReview(chunks: ChunkView[]) {
    abortController?.abort();
    abortController = new AbortController();

    const context = buildReviewContext(bible, scenePlan);
    const systemPrompt = buildReviewSystemPrompt(context);

    for (const chunk of chunks) {
      // Tier 1: Deterministic (instant) — publish immediately
      const localAnnotations = runLocalChecks(chunk.text, bible, chunk.sceneId);
      const resolvedLocal = resolveAnnotations(filterDismissed(localAnnotations, getDismissed()), chunk.text);
      annotations.set(chunk.index, resolvedLocal);
      onAnnotationsChanged(chunk.index, resolvedLocal);

      // Tier 2: LLM review (async) — merge when ready
      reviewing.add(chunk.index);
      const userPrompt = buildReviewUserPrompt(chunk.text);

      llmClient
        .review(systemPrompt, userPrompt, abortController.signal)
        .then((rawJson) => {
          const llmAnnotations = parseLLMResponse(rawJson, chunk.text);
          const all = filterDismissed([...localAnnotations, ...llmAnnotations], getDismissed());
          const resolved = resolveAnnotations(all, chunk.text);
          annotations.set(chunk.index, resolved);
          onAnnotationsChanged(chunk.index, resolved);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          console.warn("[editorial-review] LLM review failed:", err.message ?? err);
        })
        .finally(() => reviewing.delete(chunk.index));
    }
  }

  function cancelAll() {
    abortController?.abort();
    reviewing.clear();
  }

  return { requestReview, cancelAll, annotations, reviewing };
}

function resolveAnnotations(anns: EditorialAnnotation[], text: string): EditorialAnnotation[] {
  return anns
    .map((a) => {
      const match = resolveAnchor(text, a.anchor, a.charRange);
      return { ...a, charRange: { start: match.start, end: match.end } };
    })
    .filter((a) => a.charRange.start !== a.charRange.end || a.anchor.focus === "");
}

// ─── Extracted Helpers ───────────────────────────

function filterDismissed(anns: EditorialAnnotation[], dismissed: Set<string>): EditorialAnnotation[] {
  return anns.filter((a) => !dismissed.has(a.fingerprint));
}

const VALID_LLM_CATEGORIES = new Set<LLMReviewCategory>(LLM_REVIEW_CATEGORIES);
const VALID_SEVERITIES = new Set<Severity>(SEVERITIES);
const VALID_SCOPES = new Set<string>(ANNOTATION_SCOPES);

interface RawAnnotation {
  category: string;
  severity: string;
  scope: string;
  message: string;
  suggestion: string | null;
  anchor: { prefix: string; focus: string; suffix: string };
}

function isValidRawAnnotation(a: unknown): a is RawAnnotation {
  if (!a || typeof a !== "object") return false;
  const r = a as Record<string, unknown>;
  if (
    typeof r.category !== "string" ||
    !VALID_LLM_CATEGORIES.has(r.category as LLMReviewCategory) ||
    typeof r.message !== "string" ||
    typeof r.severity !== "string" ||
    typeof r.scope !== "string"
  )
    return false;
  // Validate suggestion is string | null | undefined
  if (r.suggestion !== null && r.suggestion !== undefined && typeof r.suggestion !== "string") return false;
  // Validate anchor shape
  const anchor = r.anchor as Record<string, unknown> | undefined;
  return (
    !!anchor &&
    typeof anchor.focus === "string" &&
    typeof anchor.prefix === "string" &&
    typeof anchor.suffix === "string"
  );
}

function rawToAnnotation(a: RawAnnotation, chunkText: string): EditorialAnnotation {
  const severity: Severity = VALID_SEVERITIES.has(a.severity as Severity) ? (a.severity as Severity) : "info";
  const scope = VALID_SCOPES.has(a.scope) ? a.scope : "both";
  const focusIdx = chunkText.indexOf(a.anchor.focus);
  return {
    id: generateId(),
    category: a.category,
    severity,
    scope,
    message: a.message,
    suggestion: a.suggestion ?? null,
    anchor: a.anchor,
    charRange: {
      start: focusIdx === -1 ? 0 : focusIdx,
      end: focusIdx === -1 ? 0 : focusIdx + a.anchor.focus.length,
    },
    fingerprint: hashFingerprint(a.category, a.anchor.focus),
  } as EditorialAnnotation;
}

function parseLLMResponse(raw: string, chunkText: string): EditorialAnnotation[] {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.annotations || !Array.isArray(parsed.annotations)) return [];
    return (parsed.annotations as unknown[]).filter(isValidRawAnnotation).map((a) => rawToAnnotation(a, chunkText));
  } catch {
    return [];
  }
}

export { REVIEW_OUTPUT_SCHEMA };
