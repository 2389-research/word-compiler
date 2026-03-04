/**
 * Detects and trims suggestion text that overlaps with surrounding context.
 *
 * The LLM sometimes generates suggestions that rewrite beyond the focus span,
 * repeating words from before or after the focus. When the suggestion is
 * mechanically substituted for the focus, this produces duplicated text.
 *
 * Example:
 *   prefix = "It was more like "
 *   focus  = "a file that opened without him asking"
 *   suggestion = "It was more like static that resolved into a picture"
 *   → overlap "It was more like " detected → trimmed to "static that resolved into a picture"
 */

const MIN_OVERLAP_LENGTH = 4;

export function trimSuggestionOverlap(suggestion: string, prefixText: string, suffixText: string): string {
  let result = suggestion;

  // Forward: suggestion starts with text that matches end of prefix
  const maxFwd = Math.min(prefixText.length, result.length);
  for (let len = maxFwd; len >= MIN_OVERLAP_LENGTH; len--) {
    const prefixTail = prefixText.slice(-len);
    if (result.startsWith(prefixTail)) {
      result = result.slice(len);
      break;
    }
  }

  // Backward: suggestion ends with text that matches start of suffix
  const maxBwd = Math.min(suffixText.length, result.length);
  for (let len = maxBwd; len >= MIN_OVERLAP_LENGTH; len--) {
    const suffixHead = suffixText.slice(0, len);
    if (result.endsWith(suffixHead)) {
      result = result.slice(0, -len);
      break;
    }
  }

  return result;
}
