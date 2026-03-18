import type Anthropic from "@anthropic-ai/sdk";
import type { PipelineConfig, VoiceGuide } from "../../src/profile/types.js";
import { createDefaultPipelineConfig, createEmptyVoiceGuide, createWritingSample } from "../../src/profile/types.js";
import { chunkDocument } from "../../src/profile/chunker.js";
import { countTokens } from "../../src/tokens/index.js";
import { analyzeChunks } from "./stage1.js";
import { synthesizeDocument } from "./stage2.js";
import { runDeltaUpdate } from "./delta.js";
import { textCall } from "./llm.js";

export async function updateProjectGuide(
  existingGuide: VoiceGuide | null,
  sceneText: string,
  sceneId: string,
  projectId: string,
  preferenceStatements: string[],
  client: Anthropic,
): Promise<VoiceGuide> {
  const config = createDefaultPipelineConfig();
  config.sourceDomain = "in_project";
  config.targetDomain = "in_project";

  // Create a writing sample from the scene text
  const sample = createWritingSample(sceneId, "fiction", sceneText);

  // Run Stages 1-2
  console.log(`[projectGuide] Analyzing scene ${sceneId} (${sample.wordCount} words)`);
  const chunks = chunkDocument(sample, config);
  const chunkAnalyses = await analyzeChunks(sceneId, chunks, config, client);
  const docAnalysis = await synthesizeDocument(sample, chunkAnalyses, config, client);

  let guide: VoiceGuide;

  if (existingGuide) {
    // Delta-update existing guide
    console.log(`[projectGuide] Delta-updating project guide from scene ${sceneId}`);
    guide = await runDeltaUpdate(existingGuide, [docAnalysis], "in_project", config, client);
  } else {
    // First scene — create minimal guide from Stage 2 output
    console.log(`[projectGuide] Creating initial project guide from scene ${sceneId}`);
    guide = createEmptyVoiceGuide();
    guide.version = "0.1.0";
    guide.corpusSize = 1;
    guide.domainsRepresented = ["in_project"];
    guide.narrativeSummary = docAnalysis.rawSummary;
    guide.updatedAt = new Date().toISOString();
    guide.versionHistory = [
      {
        version: "0.1.0",
        updatedAt: guide.updatedAt,
        changeReason: `Initial project guide from scene ${sceneId}`,
        changeSummary: `Created from ${docAnalysis.consistentFeatures?.length ?? 0} features.`,
        confirmedFeatures: [],
        contradictedFeatures: [],
        newFeatures: (docAnalysis.consistentFeatures ?? []).map((f) => f.name),
      },
    ];
  }

  // Distill project-specific ring1Injection
  guide.ring1Injection = await distillProjectInjection(guide, preferenceStatements, client, config);
  return guide;
}

async function distillProjectInjection(
  guide: VoiceGuide,
  preferenceStatements: string[],
  client: Anthropic,
  config: PipelineConfig,
): Promise<string> {
  const prefsBlock =
    preferenceStatements.length > 0
      ? `\n\nACCUMULATED EDIT PREFERENCES (from author's corrections):\n${preferenceStatements.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";

  const prompt = `You have a project-level style analysis and accumulated author edit preferences. Distill into a compact writing instruction (150-200 tokens) for this specific project.

PROJECT ANALYSIS:
${guide.narrativeSummary.slice(0, 2000)}
${prefsBlock}

Write direct commands for how to write THIS project. Focus on patterns specific to this work, not general writing advice. No preamble.`;

  const injection = await textCall(
    client,
    config.stage5GuideModel,
    "You are a prompt engineer. Produce a compact project-specific writing instruction.",
    prompt,
  );

  console.log(`[projectGuide] Project ring1Injection: ${countTokens(injection)} tokens`);
  return injection;
}
