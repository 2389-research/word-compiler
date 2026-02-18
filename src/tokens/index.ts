/**
 * Token counting utilities.
 *
 * Uses a words × 1.3 approximation. The interface is stable —
 * swap in tiktoken or similar when precision matters.
 */

export function countWords(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export function countTokens(text: string): number {
  return Math.ceil(countWords(text) * 1.3);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const maxWords = Math.floor(maxTokens / 1.3);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

export function lastNTokens(text: string, tokenCount: number): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const maxWords = Math.floor(tokenCount / 1.3);
  if (words.length <= maxWords) return text;
  return words.slice(-maxWords).join(" ");
}
