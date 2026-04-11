import type { EditorialAnnotation } from "./types.js";
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
          message: {
            type: "string",
            description: "Editorial rationale explaining the issue to the writer.",
          },
          suggestion: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description:
              "Verbatim replacement prose to substitute for the anchor focus text, or null if no direct replacement exists. Must be concrete text ready to drop into the manuscript — never editorial advice.",
          },
          anchor: {
            type: "object",
            properties: {
              prefix: {
                type: "string",
                description:
                  "8-15 words of verbatim prose immediately before the flagged span, for position resolution.",
              },
              focus: {
                type: "string",
                description:
                  "The EXACT verbatim text being flagged. If a suggestion is provided, this is the text the suggestion replaces — they must have the same extent.",
              },
              suffix: {
                type: "string",
                description:
                  "8-15 words of verbatim prose immediately after the flagged span, for position resolution.",
              },
            },
            required: ["prefix", "focus", "suffix"],
            additionalProperties: false,
          },
        },
        required: ["category", "severity", "scope", "message", "suggestion", "anchor"],
        additionalProperties: false,
      },
    },
  },
  required: ["annotations"],
  additionalProperties: false,
};

// ─── Fixed Prompt Sections ──────────────────────

const SEVERITY_DEFINITIONS = `SEVERITY DEFINITIONS:
- critical: Breaks a stated rule in the style guide or bible (kill list handled separately)
- warning: Weakens the prose quality, voice consistency, or narrative coherence
- info: Minor polish opportunity, stylistic suggestion`;

const ANCHOR_INSTRUCTIONS = `ANCHOR FORMAT:
For each annotation, provide an anchor object:
- prefix: 8-15 words of verbatim prose immediately before the flagged span
- focus: the EXACT verbatim text being flagged — copied character-for-character from the input
- suffix: 8-15 words of verbatim prose immediately after the flagged span
Set scope to "dialogue" for issues in spoken text, "narration" for narrative prose, or "both" if the issue spans both.

CRITICAL — FOCUS/SUGGESTION ALIGNMENT:
When you provide a suggestion, anchor.focus MUST span the COMPLETE text that the suggestion replaces.
The reader will see a squiggle under anchor.focus. Clicking "Apply" substitutes anchor.focus with suggestion.
If the issue is a duplicated phrase like "word word rest of sentence", anchor.focus must include BOTH copies plus any connecting text — not just one copy.
If the issue is a metaphor or phrasing problem, anchor.focus must cover the entire problematic phrase, not a subset of it.
Test: mentally deleting anchor.focus and inserting suggestion should produce correct prose with no leftover fragments.

SCOPE RULE — suggestion replaces ONLY anchor.focus:
The suggestion is mechanically spliced into the text at the exact position of anchor.focus. Text before and after anchor.focus is UNTOUCHED.
WRONG: focus="a file that opened" suggestion="It was more like static that resolved" — repeats "It was more like" from before the focus → "It was more like It was more like…"
WRONG: focus="cold wind" suggestion="A cold wind blew through the valley" — includes surrounding text → duplication
RIGHT: focus="a file that opened" suggestion="static that resolved"
RIGHT: focus="cold wind" suggestion="bitter draft"
If your rewrite needs to alter words outside anchor.focus, you MUST expand anchor.focus to include those words.`;

const EXCLUSION_INSTRUCTIONS =
  "Do NOT flag: kill list violations, sentence rhythm/monotony, or paragraph length issues — these are handled by separate deterministic checkers.";

const SUGGESTION_INSTRUCTIONS = `SUGGESTION FIELD RULES:
- \`suggestion\` must be VERBATIM REPLACEMENT PROSE ready to substitute for anchor.focus.
- The system performs: delete anchor.focus, insert suggestion. The result must be valid prose.
- Use \`message\` for your editorial reasoning — never put it in \`suggestion\`.
- If you cannot provide a concrete rewrite, set \`suggestion\` to null.
- NEVER put editorial advice ("Consider...", "Try...", "Perhaps...") in \`suggestion\`.`;

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
  return `AUTHOR VOICES (present in section):\n${voices}`;
}

function subtextSection(context: ReviewContext): string | null {
  if (!context.subtextPolicy) return null;
  return `SUBTEXT POLICY: ${context.subtextPolicy}`;
}

function editingInstructionsSection(context: ReviewContext): string | null {
  if (!context.editingInstructions) return null;
  return `=== AUTHOR VOICE — EDITING CHECKLIST ===\n${context.editingInstructions}`;
}

// ─── Main Builder ───────────────────────────────

export function buildReviewSystemPrompt(context: ReviewContext): string {
  const sections = [
    "You are an editorial review assistant for essays and long-form nonfiction.",
    "Flag only issues a skilled human editor would catch. Prefer fewer, high-quality annotations over many marginal ones.",
    SEVERITY_DEFINITIONS,
    metaphoricSection(context),
    vocabularySection(context),
    sentenceArchSection(context),
    structuralBansSection(context),
    killListRefSection(context),
    povSection(context),
    voicesSection(context),
    subtextSection(context),
    editingInstructionsSection(context),
    ANCHOR_INSTRUCTIONS,
    SUGGESTION_INSTRUCTIONS,
    EXCLUSION_INSTRUCTIONS,
  ].filter((s): s is string => s !== null);

  return sections.join("\n\n");
}

export function buildReviewUserPrompt(chunkText: string): string {
  return `Review the following prose chunk for editorial issues:\n\n${chunkText}`;
}

// ─── Author-Guided Suggestion Generation ─────

export const SUGGESTION_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    suggestion: {
      type: "string",
      description:
        "Verbatim replacement prose to substitute for the flagged text. Must be concrete text ready to drop into the manuscript — never editorial advice.",
    },
    rationale: {
      type: "string",
      description: "Brief explanation of the creative choices made in the suggestion.",
    },
  },
  required: ["suggestion", "rationale"],
  additionalProperties: false,
};

export function buildSuggestionRequestPrompt(
  context: ReviewContext,
  annotation: EditorialAnnotation,
  chunkText: string,
  authorFeedback: string,
): { systemPrompt: string; userPrompt: string } {
  const systemSections = [
    "You are a prose rewriting assistant for essays and long-form nonfiction.",
    "Your job: generate a VERBATIM replacement for the flagged text span. The replacement will be directly substituted into the manuscript.",
    "NEVER return editorial advice, commentary, or instructions. Return ONLY concrete prose ready for insertion.",
    metaphoricSection(context),
    vocabularySection(context),
    sentenceArchSection(context),
    structuralBansSection(context),
    killListRefSection(context),
    povSection(context),
    voicesSection(context),
    subtextSection(context),
    editingInstructionsSection(context),
  ].filter((s): s is string => s !== null);

  const systemPrompt = systemSections.join("\n\n");

  // Use resolved charRange positions to insert markers at the correct occurrence,
  // not string replace which always hits the first occurrence.
  const { start, end } = annotation.charRange;
  const markedText = `${chunkText.slice(0, start)}<<FOCUS_START>>${chunkText.slice(start, end)}<<FOCUS_END>>${chunkText.slice(end)}`;

  const userPrompt = [
    "FULL CHUNK TEXT (with focus markers):",
    markedText,
    "",
    `DIAGNOSIS: [${annotation.category}] ${annotation.message}`,
    "",
    `AUTHOR DIRECTION: ${authorFeedback}`,
    "",
    "SCOPE CONSTRAINT: Generate a replacement ONLY for the text between <<FOCUS_START>> and <<FOCUS_END>>.",
    "Everything outside the markers stays in the manuscript verbatim. Your replacement is mechanically spliced in at that exact position.",
    "Do NOT repeat or rephrase any words that appear before <<FOCUS_START>> or after <<FOCUS_END>> — they are already there.",
    "WRONG: if text reads '…It was more like <<FOCUS_START>>a file that opened<<FOCUS_END>>…' do NOT return 'It was more like static that resolved' (duplicates prefix).",
    "RIGHT: return only 'static that resolved' — the part that goes between the markers.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}
