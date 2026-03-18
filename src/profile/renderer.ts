import type { FilteredFeature, VoiceGuide } from "./types.js";

/**
 * Extract section 1 (THE CORE SENSIBILITY) from the narrative guide text.
 * Falls back to the first paragraph if the section header is not found.
 */
export function extractCoreSensibility(narrative: string): string {
  const match = narrative.match(/\d+\.\s*THE CORE SENSIBILITY\s*\n([\s\S]*?)(?=\n\d+\.\s)/i);
  if (match?.[1]) {
    return match[1].trim();
  }
  // Fallback: first paragraph
  const firstPara = narrative.split(/\n\n/)[0];
  return firstPara?.trim() ?? "";
}

/**
 * Produces the prompt fragment to inject into Ring 1 for generation.
 */
export function renderGenerationFragment(guide: VoiceGuide): string {
  const lines: string[] = [];

  lines.push(
    "Write in the voice described below. This is the writer's actual voice,",
    "extracted from their work — not a style to approximate, but a voice to inhabit.",
    "",
    "=== QUICK REFERENCE (GENERATION) ===",
    "",
    guide.generationInstructions,
    "",
    "WHAT THIS WRITER DOESN'T DO:",
  );

  if (guide.avoidancePatterns.length > 0) {
    for (const p of guide.avoidancePatterns) {
      lines.push(`- ${p.featureName}: ${p.description}`);
    }
  } else {
    lines.push("(none identified)");
  }

  // Features needing new expression in target domain
  const needsNew = collectNeedsNewObject(guide);
  lines.push("", "FEATURES NEEDING NEW EXPRESSION IN TARGET DOMAIN:");
  if (needsNew.length > 0) {
    for (const f of needsNew) {
      lines.push(`- ${f.featureName}: In source domain this worked against ${f.newObjectNote}`);
    }
  } else {
    lines.push("(none)");
  }

  lines.push("", "=== FULL VOICE GUIDE ===", "", guide.narrativeSummary);

  return lines.join("\n");
}

/**
 * Produces the prompt fragment for editorial review.
 */
export function renderEditingFragment(guide: VoiceGuide): string {
  const sensibility = extractCoreSensibility(guide.narrativeSummary);

  const lines: string[] = [];
  lines.push(
    "Review this text for voice consistency with the writer's established style.",
    "",
    "CORE SENSIBILITY:",
    sensibility,
    "",
    "=== EDITING CHECKLIST ===",
    "",
    guide.editingInstructions,
    "",
    "Return: specific passages that feel off-voice, explanation of what's wrong,",
    "and a suggested rewrite that preserves meaning but restores voice.",
  );

  return lines.join("\n");
}

/**
 * Returns the full human-readable voice guide.
 */
export function renderVoiceGuideMd(guide: VoiceGuide): string {
  return guide.narrativeSummary;
}

/**
 * Renders version history as markdown.
 */
export function renderChangelog(guide: VoiceGuide): string {
  const lines: string[] = ["# Voice Guide Changelog", ""];

  for (const v of guide.versionHistory) {
    lines.push(`## ${v.version} — ${v.updatedAt}`, "");
    lines.push(`**Reason:** ${v.changeReason}`, "");
    lines.push(v.changeSummary, "");

    if (v.confirmedFeatures.length > 0) {
      lines.push(`Confirmed: ${v.confirmedFeatures.join(", ")}`, "");
    }
    if (v.contradictedFeatures.length > 0) {
      lines.push(`Contradicted: ${v.contradictedFeatures.join(", ")}`, "");
    }
    if (v.newFeatures.length > 0) {
      lines.push(`New: ${v.newFeatures.join(", ")}`, "");
    }
  }

  return lines.join("\n");
}

// ─── Internal helpers ────────────────────────────────

function collectNeedsNewObject(guide: VoiceGuide): FilteredFeature[] {
  const all: FilteredFeature[] = [...guide.coreFeatures, ...guide.probableFeatures, ...guide.domainSpecificFeatures];
  return all.filter((f) => f.needsNewObject);
}
