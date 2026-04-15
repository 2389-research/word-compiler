import Anthropic from "@anthropic-ai/sdk";

/**
 * Retry count for transient failures (429, 408, 409, 5xx). The Anthropic SDK
 * defaults to 2; we bump this because the voice profiling pipeline makes many
 * sequential calls and a single transient failure otherwise aborts the whole
 * multi-stage run. Overridable via ANTHROPIC_MAX_RETRIES for emergencies.
 */
const DEFAULT_MAX_RETRIES = 5;

function resolveMaxRetries(): number {
  const raw = process.env.ANTHROPIC_MAX_RETRIES;
  if (!raw) return DEFAULT_MAX_RETRIES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_RETRIES;
}

/**
 * Shared Anthropic client factory. Always use this instead of `new Anthropic()`
 * directly so retry configuration stays consistent across server, scripts, and
 * eval runners.
 */
export function createAnthropicClient(): Anthropic {
  return new Anthropic({ maxRetries: resolveMaxRetries() });
}
