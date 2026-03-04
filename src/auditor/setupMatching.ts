// ─── Setup/Payoff Matching ──────────────────────────────
//
// Shared substring matching used by the auditor, reconciler, and UI.
// Bidirectional: candidate.includes(setup) || setup.includes(candidate),
// plus separator-aware matching for the "description — how" format.
//
// Short strings (<5 chars) require exact equality to prevent false
// positives like "key" matching "keyboard".

const SEPARATOR = " \u2014 ";
const MIN_SUBSTRING_LENGTH = 5;

/** Substring match only when the needle is long enough to be meaningful. */
function substringMatch(haystack: string, needle: string): boolean {
  if (needle.length < MIN_SUBSTRING_LENGTH) {
    return haystack === needle;
  }
  return haystack.includes(needle);
}

/**
 * Returns true if `candidateText` plausibly refers to the given setup.
 *
 * Matching strategies (in order):
 * 1. Bidirectional case-insensitive substring match (minimum 5 chars for substring).
 * 2. If candidateText contains " \u2014 ", extract the prefix and try again.
 *
 * Short strings (<5 chars) require exact equality to prevent false positives
 * like "key" matching "keyboard".
 */
export function matchesSetupDescription(setupDescription: string, candidateText: string): boolean {
  const setup = setupDescription.trim().toLowerCase();
  const candidate = candidateText.trim().toLowerCase();

  if (setup.length === 0 || candidate.length === 0) {
    return false;
  }

  if (substringMatch(candidate, setup) || substringMatch(setup, candidate)) {
    return true;
  }

  // Try prefix before separator (e.g. "The hidden key — found under the mat")
  const sepIndex = candidate.indexOf(SEPARATOR);
  if (sepIndex > 0) {
    const prefix = candidate.slice(0, sepIndex);
    if (substringMatch(prefix, setup) || substringMatch(setup, prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the first matching payoff text for a setup, or null.
 */
export function findPayoffForSetup(setupDescription: string, payoffTexts: string[]): string | null {
  for (const payoff of payoffTexts) {
    if (matchesSetupDescription(setupDescription, payoff)) {
      return payoff;
    }
  }
  return null;
}
