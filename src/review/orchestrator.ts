import type { Bible } from "../types/bible.js";
import type { ScenePlan } from "../types/scene.js";
import { generateId } from "../types/utils.js";
import { resolveAnchor } from "./anchorResolver.js";
import { buildReviewContext } from "./contextBuilder.js";
import { hashFingerprint } from "./fingerprint.js";
import { runLocalChecks } from "./localChecks.js";
import { buildReviewSystemPrompt, buildReviewUserPrompt, REVIEW_OUTPUT_SCHEMA } from "./prompt.js";
import type { ChunkView, EditorialAnnotation, ReviewOrchestrator } from "./types.js";

export interface LLMReviewClient {
  review(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string>;
}

export function createReviewOrchestrator(
  bible: Bible,
  scenePlan: ScenePlan,
  dismissed: Set<string>,
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
      // Tier 1: Deterministic (instant)
      const localAnnotations = runLocalChecks(chunk.text, bible, chunk.sceneId);

      // Tier 2: LLM review (async)
      reviewing.add(chunk.index);
      const userPrompt = buildReviewUserPrompt(chunk.text);

      llmClient
        .review(systemPrompt, userPrompt, abortController.signal)
        .then((rawJson) => {
          const llmAnnotations = parseLLMResponse(rawJson, chunk.text);
          const all = [...localAnnotations, ...llmAnnotations].filter((a) => !dismissed.has(a.fingerprint));
          const resolved = resolveAnnotations(all, chunk.text);
          annotations.set(chunk.index, resolved);
          onAnnotationsChanged(chunk.index, resolved);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          // LLM failed — still show local annotations
          const filtered = localAnnotations.filter((a) => !dismissed.has(a.fingerprint));
          annotations.set(chunk.index, filtered);
          onAnnotationsChanged(chunk.index, filtered);
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

function parseLLMResponse(raw: string, chunkText: string): EditorialAnnotation[] {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.annotations || !Array.isArray(parsed.annotations)) return [];
    return parsed.annotations.map(
      (a: {
        category: string;
        severity: string;
        scope: string;
        message: string;
        suggestion: string | null;
        anchor: { prefix: string; focus: string; suffix: string };
      }) => {
        const focusIdx = chunkText.indexOf(a.anchor.focus);
        return {
          id: generateId(),
          category: a.category,
          severity: a.severity,
          scope: a.scope,
          message: a.message,
          suggestion: a.suggestion ?? null,
          anchor: a.anchor,
          charRange: {
            start: focusIdx === -1 ? 0 : focusIdx,
            end: focusIdx === -1 ? 0 : focusIdx + a.anchor.focus.length,
          },
          fingerprint: hashFingerprint(a.category, a.anchor.focus),
        } as EditorialAnnotation;
      },
    );
  } catch {
    return [];
  }
}

export { REVIEW_OUTPUT_SCHEMA };
