import { levenshteinDistance } from "../learner/tuning.js";

const MIN_EDIT_RATIO = 0.1;

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripPunctuationAndCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldTriggerCipher(original: string, edited: string): boolean {
  if (original === edited) return false;
  if (!original.trim() || !edited.trim()) return false;
  if (normalizeWhitespace(original) === normalizeWhitespace(edited)) return false;
  if (stripPunctuationAndCase(original) === stripPunctuationAndCase(edited)) return false;
  const distance = levenshteinDistance(original, edited);
  const maxLen = Math.max(original.length, edited.length, 1);
  if (distance / maxLen < MIN_EDIT_RATIO) return false;
  return true;
}
