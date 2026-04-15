/**
 * Tier cascade eval — tests whether each personalization tier produces
 * meaningfully different (and progressively better) prose.
 *
 * Tiers:
 *   0. No context (baseline)
 *   1. Author voice only (out-of-domain blog posts)
 *   2. Author voice + project voice (scene analysis)
 *   3. Author voice + project voice + CIPHER (full stack)
 *   4. CIPHER only (edit preferences without author/project voice)
 *
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/eval-tier-cascade.ts
 */
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "../server/anthropicClient.js";
import Database from "better-sqlite3";
import { getVoiceGuide } from "../server/db/repositories/voice-guide.js";
import { distillVoice } from "../server/profile/projectGuide.js";
import { textCall } from "../server/profile/llm.js";
import { countTokens } from "../src/tokens/index.js";
import { createEmptyVoiceGuide } from "../src/profile/types.js";

// ─── Test scenarios ─────────────────────────────────────────────

const TEST_SCENARIOS = [
  {
    name: "emotional_scene",
    prompt:
      "Write a 200-word scene where a woman discovers her elderly neighbor has been secretly tending her garden while she was away for cancer treatment. Show the emotion without naming it.",
  },
  {
    name: "dialogue_scene",
    prompt:
      "Write a 200-word dialogue scene between two coworkers debating whether to report their manager's expense fraud. One is cautious, the other impatient. Make each voice distinct.",
  },
  {
    name: "analytical_passage",
    prompt:
      "Write a 200-word passage about why a once-thriving local newspaper couldn't survive the transition to digital, despite having loyal readers. Be specific about the economics.",
  },
];

// ─── Synthetic project voice (simulates 3 completed scenes) ─────

const SYNTHETIC_PROJECT_VOICE = `This project writes in a grounded, observational register that favors specific detail over abstraction. Emotional beats are delivered through physical action and environment — characters pull jackets tighter, stare at coffee machines, pick at labels — rather than through introspection or named feelings. The prose rhythm alternates between short declarative sentences and longer sentences interrupted by em-dashes that function as mid-thought pivots.

Dialogue is sparse and colloquial. Characters rarely say what they mean directly; subtext carries the weight. Said-bookisms are absent — "said" and action beats do the work. Conversations tend to trail off or get interrupted rather than reaching neat conclusions.

Structural habits include opening scenes with a concrete sensory detail (sound, light, texture) before establishing situation, and closing with a small observed detail that recontextualizes what came before. Transitions between beats are abrupt rather than smooth — the prose trusts the reader to bridge gaps.

Humor appears as deadpan observation embedded in otherwise serious passages. The comedic strategy is understatement and unexpected specificity ("4:47 PM — the corporate equivalent of sliding bad news under the door") rather than wit or wordplay.`;

// ─── Synthetic CIPHER preferences (from our simmered prompt) ────

const SYNTHETIC_CIPHER_PREFS = [
  "1. [REGISTER] Use plain, colloquial language and avoid ornate or elevated diction; prefer concrete nouns and active verbs over abstract conceptualizations.\n\n2. [DETAIL] Anchor abstract ideas in specific, concrete actions, objects, times, and observations rather than generalizations about feeling or significance.\n\n3. [STRUCTURE] Favor short sentences, fragments, and em-dash punctuation to create rhythm and emphasis; use fragments strategically to mirror thought or hesitation.\n\n4. [EMOTION] Show emotional states through physical action, environmental detail, and behavior rather than directly stating what characters felt or what events meant.\n\n5. [HUMOR] Deploy deadpan understatement and observational irony; find absurdity in mundane institutional or human behavior without signposting the joke.",
];

// ─── Models ─────────────────────────────────────────────────────

const GENERATION_MODEL = "claude-haiku-4-5-20251001";

async function generatePassage(
  client: Anthropic,
  systemMessage: string,
  userPrompt: string,
): Promise<string> {
  return textCall(client, GENERATION_MODEL, systemMessage, userPrompt);
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const db = new Database("./data/word-compiler.db");
  const authorGuide = getVoiceGuide(db);
  db.close();

  if (!authorGuide) {
    console.error("No author voice guide found in DB. Run the pipeline first.");
    process.exit(1);
  }

  const client = createAnthropicClient();

  // Build a synthetic project voice guide
  const projectGuide = createEmptyVoiceGuide();
  projectGuide.narrativeSummary = SYNTHETIC_PROJECT_VOICE;
  projectGuide.corpusSize = 3;

  // ─── Distill each tier's ring1Injection ─────────────────────

  console.log("[eval] Distilling tier injections...");

  // Tier 1: Author voice only
  const tier1Injection = await distillVoice(authorGuide, [], null, null, client);
  console.log(`[eval] Tier 1 (author only): ${countTokens(tier1Injection)} tokens`);

  // Tier 2: Author + project voice
  const tier2Injection = await distillVoice(authorGuide, [], projectGuide, null, client);
  console.log(`[eval] Tier 2 (author + project): ${countTokens(tier2Injection)} tokens`);

  // Tier 3: Author + project + CIPHER (full stack)
  const tier3Injection = await distillVoice(authorGuide, SYNTHETIC_CIPHER_PREFS, projectGuide, null, client);
  console.log(`[eval] Tier 3 (full stack): ${countTokens(tier3Injection)} tokens`);

  // Tier 4: CIPHER only
  const tier4Injection = await distillVoice(null, SYNTHETIC_CIPHER_PREFS, null, null, client);
  console.log(`[eval] Tier 4 (CIPHER only): ${countTokens(tier4Injection)} tokens`);

  // ─── Generate passages under each tier ──────────────────────

  const baselineSystem = "You are a skilled fiction writer. Write vivid, engaging prose.";

  const tiers = [
    { name: "tier0_no_context", system: baselineSystem, injection: null },
    { name: "tier1_author_only", system: baselineSystem, injection: tier1Injection },
    { name: "tier2_author_project", system: baselineSystem, injection: tier2Injection },
    { name: "tier3_full_stack", system: baselineSystem, injection: tier3Injection },
    { name: "tier4_cipher_only", system: baselineSystem, injection: tier4Injection },
  ];

  const results: Record<
    string,
    {
      injection: string | null;
      injectionTokens: number;
      scenarios: Array<{ scenario: string; passage: string }>;
    }
  > = {};

  for (const tier of tiers) {
    console.log(`\n[eval] === ${tier.name} ===`);
    const system = tier.injection
      ? `${tier.system}\n\n=== AUTHOR VOICE ===\n${tier.injection}`
      : tier.system;

    const scenarios: Array<{ scenario: string; passage: string }> = [];

    for (const scenario of TEST_SCENARIOS) {
      console.log(`[eval]   Generating: ${scenario.name}...`);
      const passage = await generatePassage(client, system, scenario.prompt);
      scenarios.push({ scenario: scenario.name, passage });
    }

    results[tier.name] = {
      injection: tier.injection,
      injectionTokens: tier.injection ? countTokens(tier.injection) : 0,
      scenarios,
    };
  }

  // ─── Output ─────────────────────────────────────────────────

  console.log("\n\n========================================");
  console.log("TIER CASCADE EVAL RESULTS");
  console.log("========================================\n");

  // Print injections for comparison
  for (const tier of tiers) {
    const r = results[tier.name]!;
    console.log(`\n--- ${tier.name} (${r.injectionTokens} tokens) ---`);
    if (r.injection) {
      console.log(r.injection);
    } else {
      console.log("(no injection)");
    }
  }

  // Print passages side by side per scenario
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n\n========== SCENARIO: ${scenario.name} ==========`);
    console.log(`Prompt: ${scenario.prompt}\n`);

    for (const tier of tiers) {
      const r = results[tier.name]!;
      const s = r.scenarios.find((s) => s.scenario === scenario.name);
      console.log(`\n--- ${tier.name} ---`);
      console.log(s?.passage ?? "(missing)");
    }
  }

  // Output structured JSON for programmatic analysis
  console.log("\n\n---EVAL_OUTPUT---");
  console.log(
    JSON.stringify(
      {
        tiers: Object.entries(results).map(([name, data]) => ({
          name,
          injectionTokens: data.injectionTokens,
          injection: data.injection,
          scenarios: data.scenarios,
        })),
        authorGuideExcerpt: authorGuide.narrativeSummary.slice(0, 500),
        projectVoiceExcerpt: SYNTHETIC_PROJECT_VOICE.slice(0, 500),
        cipherPrefs: SYNTHETIC_CIPHER_PREFS,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
