import type { ReviewContext } from "./types.js";

const LLM_CATEGORIES = [
  "tone",
  "grammar",
  "voice",
  "punctuation",
  "show_dont_tell",
  "pov",
  "dialogue",
  "metaphor",
  "vocabulary",
  "continuity",
] as const;

export const REVIEW_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...LLM_CATEGORIES] },
          severity: { type: "string", enum: ["critical", "warning", "info"] },
          scope: { type: "string", enum: ["dialogue", "narration", "both"] },
          message: { type: "string" },
          suggestion: { anyOf: [{ type: "string" }, { type: "null" }] },
          anchor: {
            type: "object",
            properties: {
              prefix: { type: "string" },
              focus: { type: "string" },
              suffix: { type: "string" },
            },
            required: ["prefix", "focus", "suffix"],
          },
        },
        required: ["category", "severity", "scope", "message", "suggestion", "anchor"],
      },
    },
  },
  required: ["annotations"],
};

export function buildReviewSystemPrompt(context: ReviewContext): string {
  const sections: string[] = [];

  sections.push("You are an editorial review assistant for long-form fiction.");
  sections.push(
    "Flag only issues a skilled human editor would catch. Prefer fewer, high-quality annotations over many marginal ones.",
  );

  // Severity definitions
  sections.push(`SEVERITY DEFINITIONS:
- critical: Breaks a stated rule in the style guide or bible (kill list handled separately)
- warning: Weakens the prose quality, voice consistency, or narrative coherence
- info: Minor polish opportunity, stylistic suggestion`);

  // Style rules
  if (context.styleRules.metaphoricRegister) {
    const mr = context.styleRules.metaphoricRegister;
    const approved = mr.approvedDomains.length > 0 ? mr.approvedDomains.join(", ") : "none specified";
    const prohibited = mr.prohibitedDomains.length > 0 ? mr.prohibitedDomains.join(", ") : "none";
    sections.push(`METAPHORIC REGISTER: Approved domains=${approved}, Prohibited=${prohibited}`);
  }

  if (context.styleRules.vocabularyPreferences.length > 0) {
    const prefs = context.styleRules.vocabularyPreferences.map((v) => `${v.preferred} (not ${v.insteadOf})`).join("; ");
    sections.push(`VOCABULARY PREFERENCES: ${prefs}`);
  }

  if (context.styleRules.sentenceArchitecture) {
    const sa = context.styleRules.sentenceArchitecture;
    sections.push(
      `SENTENCE ARCHITECTURE: Target variance=${sa.targetVariance ?? "unspecified"}, Fragment policy=${sa.fragmentPolicy ?? "unspecified"}`,
    );
  }

  if (context.styleRules.structuralBans.length > 0) {
    sections.push(`STRUCTURAL BANS: ${context.styleRules.structuralBans.join(", ")}`);
  }

  // Kill list reference (DO NOT re-flag)
  if (context.styleRules.killList.length > 0) {
    sections.push(
      "KILL LIST (reference only — do NOT flag these, they are handled by a separate deterministic checker): " +
        context.styleRules.killList.map((k) => k.pattern).join(", "),
    );
  }

  // POV rules
  if (context.povRules) {
    sections.push(
      `POV RULES: Distance=${context.povRules.distance}, Interiority=${context.povRules.interiority}, Reliability=${context.povRules.reliability}`,
    );
  }

  // Voice fingerprints
  if (context.activeVoices.length > 0) {
    const voices = context.activeVoices.map((v) => `${v.name}: ${v.fingerprint}`).join("\n");
    sections.push(`CHARACTER VOICES (present in scene):\n${voices}`);
  }

  // Tone
  if (context.toneIntent) {
    sections.push(`TONE INTENT: ${context.toneIntent}`);
  }

  // Anchor instructions
  sections.push(`ANCHOR FORMAT:
For each annotation, provide an anchor object with prefix (8-15 words before), focus (the exact text being flagged), and suffix (8-15 words after). These are used for position resolution.
Set scope to "dialogue" for issues in spoken text, "narration" for narrative prose, or "both" if the issue spans both.`);

  // Exclusions
  sections.push(
    "Do NOT flag: kill list violations, sentence rhythm/monotony, or paragraph length issues — these are handled by separate deterministic checkers.",
  );

  return sections.join("\n\n");
}

export function buildReviewUserPrompt(chunkText: string): string {
  return `Review the following prose chunk for editorial issues:\n\n${chunkText}`;
}
