import Anthropic from "@anthropic-ai/sdk";

/**
 * Retry count for transient failures (429, 408, 409, 5xx). The Anthropic SDK
 * defaults to 2; we bump this because the voice profiling pipeline makes many
 * sequential calls and a single transient failure otherwise aborts the whole
 * multi-stage run. Overridable via ANTHROPIC_MAX_RETRIES for emergencies.
 */
const DEFAULT_MAX_RETRIES = 5;
const MAX_ALLOWED_RETRIES = 20;

function resolveMaxRetries(): number {
  const raw = process.env.ANTHROPIC_MAX_RETRIES;
  if (!raw) return DEFAULT_MAX_RETRIES;
  // Require a strict integer string — `Number.parseInt` would accept "5abc"
  // and silently mask bad config.
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_MAX_RETRIES;
  return Math.min(parsed, MAX_ALLOWED_RETRIES);
}

/**
 * Shared Anthropic client factory. Always use this instead of `new Anthropic()`
 * directly so retry configuration stays consistent across server, scripts, and
 * eval runners.
 */
export function createAnthropicClient(): Anthropic {
  return new Anthropic({ maxRetries: resolveMaxRetries() });
}
