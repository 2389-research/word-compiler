import { checkParagraphLength, checkSentenceVariance } from "../auditor/index.js";
import type { Bible } from "../types/bible.js";
import { generateId } from "../types/utils.js";
import { hashFingerprint } from "./fingerprint.js";
import type { EditorialAnnotation, LocalReviewCategory, Severity } from "./types.js";

export function runLocalChecks(text: string, bible: Bible, sceneId: string): EditorialAnnotation[] {
  return [
    ...buildKillListAnnotations(text, bible, sceneId),
    ...buildVarianceAnnotations(text, sceneId),
    ...buildParagraphAnnotations(text, bible, sceneId),
  ];
}

// Scan the kill list directly — one pass per unique pattern.
// Avoids calling checkKillList (which scans once per pattern) then re-scanning
// via findAllPatternOccurrences, which doubled the work.
function buildKillListAnnotations(text: string, bible: Bible, _sceneId: string): EditorialAnnotation[] {
  const lowerText = text.toLowerCase();
  const result: EditorialAnnotation[] = [];
  for (const entry of bible.styleGuide.killList) {
    const pattern = entry.pattern.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(pattern, searchFrom);
      if (idx === -1) break;
      const message = `"${entry.pattern}" — kill list violation`;
      result.push(flagToAnnotation("warning", "kill_list", message, text, idx, idx + pattern.length));
      searchFrom = idx + 1;
    }
  }
  return result;
}

function buildVarianceAnnotations(text: string, sceneId: string): EditorialAnnotation[] {
  const result: EditorialAnnotation[] = [];
  const varianceFlags = checkSentenceVariance(text, sceneId);
  for (const flag of varianceFlags) {
    const snippet = extractQuotedSnippet(flag.message);
    if (snippet) {
      const match = findSnippetInText(text, snippet);
      if (match.start === match.end) continue;
      result.push(flagToAnnotation(flag.severity, "rhythm_monotony", flag.message, text, match.start, match.end));
    } else {
      const firstSentenceEnd = text.indexOf(".") !== -1 ? text.indexOf(".") + 1 : Math.min(text.length, 80);
      result.push(flagToAnnotation(flag.severity, "rhythm_monotony", flag.message, text, 0, firstSentenceEnd));
    }
  }
  return result;
}

function buildParagraphAnnotations(text: string, bible: Bible, sceneId: string): EditorialAnnotation[] {
  const maxSentences = bible.styleGuide.paragraphPolicy?.maxSentences ?? null;
  const paraFlags = checkParagraphLength(text, maxSentences, sceneId);
  const result: EditorialAnnotation[] = [];
  for (const flag of paraFlags) {
    const paraSnippet = extractQuotedSnippet(flag.message);
    const match = paraSnippet ? findSnippetInText(text, paraSnippet) : { start: 0, end: 0 };
    if (match.start === match.end) continue;
    result.push(flagToAnnotation(flag.severity, "paragraph_length", flag.message, text, match.start, match.end));
  }
  return result;
}

function buildAnchor(text: string, start: number, end: number): EditorialAnnotation["anchor"] {
  const focusText = start < end ? text.slice(start, end) : "";
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

function extractQuotedSnippet(message: string): string | null {
  // Match quoted text with or without trailing ellipsis: "text..." or "text"
  const match = message.match(/"(.+?)(?:\.\.\.)?"/);
  return match?.[1] ?? null;
}

function findSnippetInText(text: string, snippet: string): { start: number; end: number } {
  const idx = text.indexOf(snippet);
  if (idx === -1) return { start: 0, end: 0 };
  // Find end of paragraph
  const paraEnd = text.indexOf("\n\n", idx);
  return { start: idx, end: paraEnd === -1 ? text.length : paraEnd };
}
