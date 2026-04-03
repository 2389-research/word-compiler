/**
 * Safely parse a JSON string from a database column.
 * Returns null and logs a warning instead of throwing on malformed data.
 */
export function safeJsonParse<T>(json: string, context: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.error(`[db] Failed to parse JSON in ${context}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
