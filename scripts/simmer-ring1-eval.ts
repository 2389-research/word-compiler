/**
 * Simmer evaluator for ring1Injection quality.
 *
 * Loads the VoiceGuide from DB, runs the Stage 6 distillation prompt,
 * generates test passages with and without the injection, outputs all
 * results for the judge.
 *
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/simmer-ring1-eval.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { getVoiceGuide } from "../server/db/repositories/voice-guide.js";
import { listWritingSamples } from "../server/db/repositories/writing-samples.js";
import { textCall } from "../server/profile/llm.js";
import { countTokens } from "../src/tokens/index.js";

// ─── Stage 6 distillation prompt (THE MUTABLE ARTIFACT) ───────────
// This is what the simmer generator modifies between iterations.
// It lives in this file so the generator can edit it directly.

const STAGE6_SYSTEM =
  "You are a prompt engineer specializing in voice-matched prose generation. Produce the most compact, effective system message instruction possible.";

function buildStage6Prompt(guideText: string): string {
  return `You have a detailed voice guide for an author. Distill it into a compact writing instruction (200-300 tokens max) that will be injected into an LLM system message to make generated prose match this author's voice.

The instruction should:
- Be written as direct commands ("Write with measured warmth...", "Avoid melodrama...", "When describing emotion, ground it in physical detail...")
- Capture the 3-4 most distinctive positive patterns from the guide
- Capture the 2-3 strongest avoidance patterns
- Calibrate the register: specify the author's diction level explicitly. If the author writes at a conversational-professional register (plain syntax, occasional informal phrasing, no literary flourishes or aphoristic closings), say so directly — e.g. "Write at a conversational register — the prose should read like a smart person talking to peers, not like a writer performing craft."
- Include at least one directive about register/diction level, not just content patterns
- Be specific to THIS author, not generic writing advice
- Be concise — every token counts in a system message

VOICE GUIDE:
${guideText}

Write ONLY the compact instruction. No preamble, no headers, no explanation.`;
}

// ─── Test scenarios ────────────────────────────────────────────────

const TEST_SCENARIOS = [
  {
    name: "analytical_reporting",
    description: "Close to Jacqui's natural domain — analytical tech reporting",
    prompt:
      "Write a 200-word analysis of why a beloved neighborhood bookstore is closing despite community support. Include specific details about the economics and the emotional impact on regulars.",
  },
  {
    name: "narrative_fiction",
    description: "The target domain — literary fiction scene",
    prompt:
      "Write a 200-word scene where a woman returns to her childhood home after fifteen years to find her father has turned her bedroom into a workshop. Show, don't tell, the emotion.",
  },
  {
    name: "dialogue_heavy",
    description: "Tests character voice differentiation",
    prompt:
      "Write a 200-word dialogue scene between two old friends who disagree about whether to renovate or demolish a community center. Each character should have a distinct voice.",
  },
];

// ─── Generation ────────────────────────────────────────────────────

const GENERATION_MODEL = "claude-haiku-4-5-20251001";
const DISTILLATION_MODEL = "claude-sonnet-4-5-20250929";

async function generatePassage(
  client: Anthropic,
  systemMessage: string,
  userPrompt: string,
): Promise<string> {
  return textCall(client, GENERATION_MODEL, systemMessage, userPrompt);
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const db = new Database("./data/word-compiler.db");
  const guide = getVoiceGuide(db);
  const samples = listWritingSamples(db);
  db.close();

  if (!guide) {
    console.error("No voice guide found in DB. Run the pipeline first.");
    process.exit(1);
  }

  const client = new Anthropic();

  // Step 1: Run Stage 6 distillation
  console.log("[eval] Distilling ring1Injection...");
  const ring1Injection = await textCall(
    client,
    DISTILLATION_MODEL,
    STAGE6_SYSTEM,
    buildStage6Prompt(guide.narrativeSummary),
  );
  console.log(`[eval] ring1Injection: ${countTokens(ring1Injection)} tokens`);

  // Step 2: Generate baseline and personalized passages
  const baselineSystem = "You are a skilled fiction writer. Write vivid, engaging prose.";
  const personalizedSystem = `You are a skilled fiction writer. Write vivid, engaging prose.\n\n=== AUTHOR VOICE ===\n${ring1Injection}`;

  const results: Array<{
    scenario: string;
    description: string;
    baseline: string;
    personalized: string;
  }> = [];

  for (const scenario of TEST_SCENARIOS) {
    console.log(`[eval] Generating: ${scenario.name}...`);

    const baseline = await generatePassage(client, baselineSystem, scenario.prompt);
    const personalized = await generatePassage(client, personalizedSystem, scenario.prompt);

    results.push({
      scenario: scenario.name,
      description: scenario.description,
      baseline,
      personalized,
    });
  }

  // Step 3: Output everything for the judge
  const output = {
    ring1Injection,
    ring1InjectionTokens: countTokens(ring1Injection),
    sampleCount: samples.length,
    sampleSummaries: samples.map((s) => ({
      filename: s.filename,
      domain: s.domain,
      wordCount: s.wordCount,
      excerpt: s.text.slice(0, 300),
    })),
    scenarios: results,
    guideNarrativeSummaryExcerpt: guide.narrativeSummary.slice(0, 2000),
  };

  console.log("---EVAL_OUTPUT---");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
