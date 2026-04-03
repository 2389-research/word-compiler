import type Anthropic from "@anthropic-ai/sdk";
import { chunkDocument } from "../../src/profile/chunker.js";
import type { PipelineConfig, VoiceGuide } from "../../src/profile/types.js";
import { createDefaultPipelineConfig, createEmptyVoiceGuide, createWritingSample } from "../../src/profile/types.js";
import { countTokens } from "../../src/tokens/index.js";
import { DEFAULT_ANALYSIS_MODEL } from "../../src/types/metadata.js";
import { textCall } from "./llm.js";
import { analyzeChunks } from "./stage1.js";
import { synthesizeDocument } from "./stage2.js";

// ─── Project Voice: scene-by-scene in-domain analysis ────────────

const SYNTHESIS_SYSTEM =
  "You are a writing style analyst building an evolving understanding of a fiction project's voice from completed scenes.";

/**
 * Update the project voice summary by analyzing a completed scene
 * and integrating it with the existing project voice (if any).
 *
 * This does NOT produce a ring1Injection — that happens in distillVoice(),
 * which combines all three evidence sources.
 */
export async function updateProjectVoice(
  existingGuide: VoiceGuide | null,
  sceneText: string,
  sceneId: string,
  client: Anthropic,
): Promise<VoiceGuide> {
  const config = createDefaultPipelineConfig();
  config.sourceDomain = "in_project";
  config.targetDomain = "in_project";

  const sample = createWritingSample(sceneId, "fiction", sceneText);

  // Run Stages 1-2 on the new scene
  console.log(`[projectVoice] Analyzing scene ${sceneId} (${sample.wordCount} words)`);
  const chunks = chunkDocument(sample, config);
  const chunkAnalyses = await analyzeChunks(sceneId, chunks, config, client);
  const docAnalysis = await synthesizeDocument(sample, chunkAnalyses, config, client);

  const sceneNumber = existingGuide ? existingGuide.corpusSize + 1 : 1;
  console.log(`[projectVoice] Synthesizing project voice (scene ${sceneNumber})`);

  const narrativeSummary = await synthesizeProjectVoice(
    existingGuide,
    docAnalysis.rawSummary,
    sceneNumber,
    client,
    config,
  );

  const guide = existingGuide ? structuredClone(existingGuide) : createEmptyVoiceGuide();
  const version = existingGuide ? bumpPatch(existingGuide.version) : "0.1.0";

  guide.version = version;
  guide.corpusSize = sceneNumber;
  guide.domainsRepresented = ["in_project"];
  guide.narrativeSummary = narrativeSummary;
  guide.updatedAt = new Date().toISOString();
  guide.versionHistory.push({
    version,
    updatedAt: guide.updatedAt,
    changeReason: existingGuide ? `Updated from scene ${sceneId}` : `Initial project voice from scene ${sceneId}`,
    changeSummary: `Synthesized from ${sceneNumber} scene${sceneNumber > 1 ? "s" : ""}.`,
    confirmedFeatures: [],
    contradictedFeatures: [],
    newFeatures: [],
  });

  // No ring1Injection here — that's distillVoice()'s job
  guide.ring1Injection = "";

  console.log(`[projectVoice] v${version}: ${sceneNumber} scenes, ${countTokens(narrativeSummary)} tokens`);
  return guide;
}

function bumpPatch(version: string): string {
  const [major, minor, patch] = version.split(".").map(Number) as [number, number, number];
  return `${major}.${minor}.${patch + 1}`;
}

async function synthesizeProjectVoice(
  existingGuide: VoiceGuide | null,
  newSceneAnalysis: string,
  sceneNumber: number,
  client: Anthropic,
  config: PipelineConfig,
): Promise<string> {
  let prompt: string;

  if (existingGuide) {
    prompt = `You are maintaining a project voice summary that evolves as more scenes are completed.

EXISTING PROJECT VOICE (based on ${existingGuide.corpusSize} scene${existingGuide.corpusSize > 1 ? "s" : ""}):
${existingGuide.narrativeSummary}

NEW SCENE ANALYSIS (scene ${sceneNumber}):
${newSceneAnalysis}

Update the project voice summary by integrating what we learned from this new scene. Rules:
- PRESERVE patterns from the existing summary that the new scene confirms or doesn't contradict
- ADD new patterns the new scene reveals
- If the new scene shows something different, note the variation — don't delete unless clearly wrong
- Weight the existing summary more heavily — it represents ${existingGuide.corpusSize} scene${existingGuide.corpusSize > 1 ? "s" : ""} of evidence
- Write as a cohesive voice summary, not a changelog

3-5 paragraphs covering: core voice patterns, emotional handling, structural habits. No headers or metadata.`;
  } else {
    prompt = `Write an initial project voice summary based on the first completed scene.

SCENE ANALYSIS:
${newSceneAnalysis}

Capture what we know so far about this project's voice. Be appropriately tentative — this is one scene. Note which patterns seem deliberate vs. scene-specific.

3-5 paragraphs covering: emerging voice patterns, emotional handling, structural habits. No headers or metadata.`;
  }

  return textCall(client, config.stage5GuideModel, SYNTHESIS_SYSTEM, prompt);
}

// ─── Unified Distillation: combine all 3 evidence sources ────────

const DISTILL_SYSTEM =
  "You are a prompt engineer specializing in voice-matched prose generation. Produce the most compact, effective system message instruction possible.";

/**
 * Distill a single ring1Injection from all available evidence:
 * 1. Author voice guide (out-of-domain baseline from writing samples)
 * 2. CIPHER preferences (explicit author corrections, highest signal)
 * 3. Project voice (in-domain scene analyses)
 *
 * Any source may be absent. The distillation adapts to what's available.
 */
export async function distillVoice(
  authorGuide: VoiceGuide | null,
  cipherPreferences: string[],
  projectGuide: VoiceGuide | null,
  currentInjection: string | null,
  client: Anthropic,
): Promise<string> {
  const sections: string[] = [];

  if (currentInjection) {
    sections.push(`CURRENT VOICE INSTRUCTION (the baseline — evolve this, don't replace it):
${currentInjection}`);
  }

  if (authorGuide?.narrativeSummary) {
    sections.push(`AUTHOR VOICE (from ${authorGuide.corpusSize} writing sample${authorGuide.corpusSize !== 1 ? "s" : ""}, out-of-domain):
${authorGuide.narrativeSummary}`);
  }

  if (cipherPreferences.length > 0) {
    sections.push(`AUTHOR EDIT PREFERENCES (explicit corrections to LLM prose — highest signal):
${cipherPreferences.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  }

  if (projectGuide?.narrativeSummary) {
    sections.push(`PROJECT VOICE (from ${projectGuide.corpusSize} completed scene${projectGuide.corpusSize !== 1 ? "s" : ""}, in-domain):
${projectGuide.narrativeSummary}`);
  }

  if (sections.length === 0) {
    return "";
  }

  const isIncremental = !!currentInjection;

  const prompt = isIncremental
    ? `You have an existing voice instruction and new evidence about the author's writing. Update the instruction incrementally — preserve what's working and integrate new signals.

${sections.join("\n\n")}

Rules:
- Start from the CURRENT VOICE INSTRUCTION as your baseline
- Integrate new evidence gradually — small refinements, not wholesale rewrites
- A single scene or CIPHER batch should shift the instruction slightly, not transform it
- Only drop an existing directive if new evidence clearly contradicts it across multiple sources
- The instruction should feel stable over time, evolving slowly as evidence accumulates`
    : `Distill the following evidence about an author's writing voice into a compact writing instruction (200-300 tokens) for an LLM system message.

${sections.join("\n\n")}`;

  const sharedRules = `
Priority order for conflicts:
1. AUTHOR EDIT PREFERENCES (explicit corrections — the author literally changed this)
2. PROJECT VOICE (in-domain evidence from their fiction)
3. AUTHOR VOICE (out-of-domain baseline — valuable but may not fully transfer)

The instruction should:
- Be written as direct commands ("Write with...", "Avoid...", "When X, do Y...")
- Capture the most distinctive patterns across all sources
- Calibrate register explicitly
- Be specific to THIS author, not generic writing advice
- Be concise — every token counts in a system message

Write ONLY the compact instruction. No preamble, no headers.`;

  const injection = await textCall(client, DEFAULT_ANALYSIS_MODEL, DISTILL_SYSTEM, prompt + sharedRules);

  console.log(
    `[distillVoice] ring1Injection: ${countTokens(injection)} tokens from ${sections.length} source${sections.length !== 1 ? "s" : ""}`,
  );
  return injection;
}
