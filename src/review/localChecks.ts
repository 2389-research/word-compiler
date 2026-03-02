import { checkKillList, checkParagraphLength, checkSentenceVariance } from "../auditor/index.js";
import type { Bible } from "../types/bible.js";
import { generateId } from "../types/utils.js";
import { hashFingerprint } from "./fingerprint.js";
import type { EditorialAnnotation, LocalReviewCategory, Severity } from "./types.js";

export function runLocalChecks(text: string, bible: Bible, sceneId: string): EditorialAnnotation[] {
  const annotations: EditorialAnnotation[] = [];

  // Kill list
  annotations.push(...buildKillListAnnotations(text, bible, sceneId));

  // Sentence variance — anchor per-sentence flags to their specific snippet
  const varianceFlags = checkSentenceVariance(text, sceneId);
  for (const flag of varianceFlags) {
    const snippet = extractQuotedSnippet(flag.message);
    if (snippet) {
      const match = findSnippetInText(text, snippet);
      annotations.push(flagToAnnotation(flag.severity, "rhythm_monotony", flag.message, text, match.start, match.end));
    } else {
      // Overall stddev flag — anchor to first sentence as document-level indicator
      const firstSentenceEnd = text.indexOf(".") !== -1 ? text.indexOf(".") + 1 : Math.min(text.length, 80);
      annotations.push(flagToAnnotation(flag.severity, "rhythm_monotony", flag.message, text, 0, firstSentenceEnd));
    }
  }

  // Paragraph length
  const maxSentences = bible.styleGuide.paragraphPolicy?.maxSentences ?? null;
  const paraFlags = checkParagraphLength(text, maxSentences, sceneId);
  for (const flag of paraFlags) {
    const paraSnippet = extractQuotedSnippet(flag.message);
    const match = paraSnippet ? findSnippetInText(text, paraSnippet) : { start: 0, end: 0 };
    annotations.push(flagToAnnotation(flag.severity, "paragraph_length", flag.message, text, match.start, match.end));
  }

  return annotations;
}

// Deduplicate by pattern to avoid N*N annotations. checkKillList returns
// one flag per occurrence, so we group by pattern and scan once per unique pattern.
function buildKillListAnnotations(text: string, bible: Bible, sceneId: string): EditorialAnnotation[] {
  const killFlags = checkKillList(text, bible.styleGuide.killList, sceneId);
  const seenPatterns = new Set<string>();
  const result: EditorialAnnotation[] = [];
  for (const flag of killFlags) {
    const patternMatch = flag.message.match(/"(.+?)"/);
    const pattern = patternMatch?.[1]?.toLowerCase();
    if (!pattern || seenPatterns.has(pattern)) continue;
    seenPatterns.add(pattern);
    const matches = findAllPatternOccurrences(text, flag.message);
    for (const match of matches) {
      result.push(flagToAnnotation(flag.severity, "kill_list", flag.message, text, match.start, match.end));
    }
  }
  return result;
}

function buildAnchor(text: string, start: number, end: number): EditorialAnnotation["anchor"] {
  const focusText = start < end ? text.slice(start, Math.min(end, start + 60)) : "";
  const prefixStart = Math.max(0, start - 20);
  const suffixEnd = Math.min(text.length, end + 20);
  return {
    prefix: text.slice(prefixStart, start),
    focus: focusText,
    suffix: text.slice(end, suffixEnd),
  };
}

function flagToAnnotation(
  severity: Severity,
  category: LocalReviewCategory,
  message: string,
  text: string,
  start: number,
  end: number,
): EditorialAnnotation {
  const anchor = buildAnchor(text, start, end);
  return {
    id: generateId(),
    category,
    severity,
    scope: "both",
    message,
    suggestion: null,
    anchor,
    charRange: { start, end },
    fingerprint: hashFingerprint(category, anchor.focus),
  };
}

function findAllPatternOccurrences(text: string, flagMessage: string): Array<{ start: number; end: number }> {
  const match = flagMessage.match(/"(.+?)"/);
  if (!match?.[1]) return [{ start: 0, end: 0 }];
  const pattern = match[1].toLowerCase();
  const lowerText = text.toLowerCase();
  const results: Array<{ start: number; end: number }> = [];
  let searchFrom = 0;
  while (searchFrom < lowerText.length) {
    const idx = lowerText.indexOf(pattern, searchFrom);
    if (idx === -1) break;
    results.push({ start: idx, end: idx + pattern.length });
    searchFrom = idx + 1;
  }
  return results.length > 0 ? results : [{ start: 0, end: 0 }];
}

function extractQuotedSnippet(message: string): string | null {
  const match = message.match(/"(.+?)\.\.\."/);
  return match?.[1] ?? null;
}

function findSnippetInText(text: string, snippet: string): { start: number; end: number } {
  const idx = text.indexOf(snippet);
  if (idx === -1) return { start: 0, end: 0 };
  // Find end of paragraph
  const paraEnd = text.indexOf("\n\n", idx);
  return { start: idx, end: paraEnd === -1 ? text.length : paraEnd };
}
