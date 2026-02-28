import { ANNOTATION_SCOPES, LLM_REVIEW_CATEGORIES, type ReviewContext, SEVERITIES } from "./types.js";

export const REVIEW_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...LLM_REVIEW_CATEGORIES] },
          severity: { type: "string", enum: [...SEVERITIES] },
          scope: { type: "string", enum: [...ANNOTATION_SCOPES] },
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

// ─── Fixed Prompt Sections ──────────────────────

const SEVERITY_DEFINITIONS = `SEVERITY DEFINITIONS:
- critical: Breaks a stated rule in the style guide or bible (kill list handled separately)
- warning: Weakens the prose quality, voice consistency, or narrative coherence
- info: Minor polish opportunity, stylistic suggestion`;

const ANCHOR_INSTRUCTIONS = `ANCHOR FORMAT:
For each annotation, provide an anchor object with prefix (8-15 words before), focus (the exact text being flagged), and suffix (8-15 words after). These are used for position resolution.
Set scope to "dialogue" for issues in spoken text, "narration" for narrative prose, or "both" if the issue spans both.`;

const EXCLUSION_INSTRUCTIONS =
  "Do NOT flag: kill list violations, sentence rhythm/monotony, or paragraph length issues — these are handled by separate deterministic checkers.";

// ─── Conditional Section Builders ───────────────

function metaphoricSection(context: ReviewContext): string | null {
  const mr = context.styleRules.metaphoricRegister;
  if (!mr) return null;
  const approved = mr.approvedDomains.length > 0 ? mr.approvedDomains.join(", ") : "none specified";
  const prohibited = mr.prohibitedDomains.length > 0 ? mr.prohibitedDomains.join(", ") : "none";
  return `METAPHORIC REGISTER: Approved domains=${approved}, Prohibited=${prohibited}`;
}

function vocabularySection(context: ReviewContext): string | null {
  if (context.styleRules.vocabularyPreferences.length === 0) return null;
  const prefs = context.styleRules.vocabularyPreferences.map((v) => `${v.preferred} (not ${v.insteadOf})`).join("; ");
  return `VOCABULARY PREFERENCES: ${prefs}`;
}

function sentenceArchSection(context: ReviewContext): string | null {
  const sa = context.styleRules.sentenceArchitecture;
  if (!sa) return null;
  return `SENTENCE ARCHITECTURE: Target variance=${sa.targetVariance ?? "unspecified"}, Fragment policy=${sa.fragmentPolicy ?? "unspecified"}`;
}

function structuralBansSection(context: ReviewContext): string | null {
  if (context.styleRules.structuralBans.length === 0) return null;
  return `STRUCTURAL BANS: ${context.styleRules.structuralBans.join(", ")}`;
}

function killListRefSection(context: ReviewContext): string | null {
  if (context.styleRules.killList.length === 0) return null;
  return (
    "KILL LIST (reference only — do NOT flag these, they are handled by a separate deterministic checker): " +
    context.styleRules.killList.map((k) => k.pattern).join(", ")
  );
}

function povSection(context: ReviewContext): string | null {
  if (!context.povRules) return null;
  return `POV RULES: Distance=${context.povRules.distance}, Interiority=${context.povRules.interiority}, Reliability=${context.povRules.reliability}`;
}

function voicesSection(context: ReviewContext): string | null {
  if (context.activeVoices.length === 0) return null;
  const voices = context.activeVoices.map((v) => `${v.name}: ${v.fingerprint}`).join("\n");
  return `CHARACTER VOICES (present in scene):\n${voices}`;
}

function toneSection(context: ReviewContext): string | null {
  if (!context.toneIntent) return null;
  return `TONE INTENT: ${context.toneIntent}`;
}

// ─── Main Builder ───────────────────────────────

export function buildReviewSystemPrompt(context: ReviewContext): string {
  const sections = [
    "You are an editorial review assistant for long-form fiction.",
    "Flag only issues a skilled human editor would catch. Prefer fewer, high-quality annotations over many marginal ones.",
    SEVERITY_DEFINITIONS,
    metaphoricSection(context),
    vocabularySection(context),
    sentenceArchSection(context),
    structuralBansSection(context),
    killListRefSection(context),
    povSection(context),
    voicesSection(context),
    toneSection(context),
    ANCHOR_INSTRUCTIONS,
    EXCLUSION_INSTRUCTIONS,
  ].filter((s): s is string => s !== null);

  return sections.join("\n\n");
}

export function buildReviewUserPrompt(chunkText: string): string {
  return `Review the following prose chunk for editorial issues:\n\n${chunkText}`;
}
