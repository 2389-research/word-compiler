import type Anthropic from "@anthropic-ai/sdk";
import { buildStage2Prompt, STAGE2_SYSTEM } from "../../src/profile/prompts.js";
import type {
  ChunkAnalysis,
  DocumentAnalysis,
  DocumentSynthesisResponse,
  PipelineConfig,
  WritingSample,
} from "../../src/profile/types.js";
import { structuredCall } from "./llm.js";

const DOCUMENT_SYNTHESIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    consistentFeatures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string" },
        },
        required: ["name", "description", "evidence", "confidence"],
      },
    },
    variableFeatures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          formatCondition: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string" },
        },
        required: ["name", "description", "formatCondition", "evidence", "confidence"],
      },
    },
    dominantVoiceMarkers: { type: "array", items: { type: "string" } },
    structuralPatterns: { type: "array", items: { type: "string" } },
    avoidancePatterns: { type: "array", items: { type: "string" } },
    rawSummary: { type: "string" },
  },
  required: [
    "consistentFeatures",
    "variableFeatures",
    "dominantVoiceMarkers",
    "structuralPatterns",
    "avoidancePatterns",
    "rawSummary",
  ],
};

export function computeDriftRatio(analyses: Pick<ChunkAnalysis, "contentDriftScore">[]): number {
  if (analyses.length === 0) return 0;
  const totalScore = analyses.reduce((sum, a) => sum + a.contentDriftScore, 0);
  return totalScore / analyses.length;
}

export async function synthesizeDocument(
  sample: WritingSample,
  chunkAnalyses: ChunkAnalysis[],
  config: PipelineConfig,
  client: Anthropic,
): Promise<DocumentAnalysis> {
  const driftedChunks = chunkAnalyses
    .filter((a) => a.contentDriftScore >= config.driftDownweightThreshold)
    .map((a) => a.chunkIndex);
  const driftRatio = computeDriftRatio(chunkAnalyses);

  if (driftRatio > config.driftExclusionThreshold) {
    console.warn(
      `[stage2] Document "${sample.filename ?? sample.id}" has drift ratio ${driftRatio.toFixed(2)} exceeding threshold ${config.driftExclusionThreshold}`,
    );
  }

  const analysesJson = JSON.stringify(chunkAnalyses, null, 2);
  const prompt = buildStage2Prompt(
    analysesJson,
    driftedChunks,
    null,
    sample.domain,
    sample.wordCount,
    chunkAnalyses.length,
  );

  const response = await structuredCall<DocumentSynthesisResponse>(
    client,
    config.stage2DocumentModel,
    STAGE2_SYSTEM,
    prompt,
    DOCUMENT_SYNTHESIS_SCHEMA,
    "document_synthesis",
  );

  return {
    consistentFeatures: response.consistentFeatures ?? [],
    variableFeatures: response.variableFeatures ?? [],
    dominantVoiceMarkers: response.dominantVoiceMarkers ?? [],
    structuralPatterns: response.structuralPatterns ?? [],
    avoidancePatterns: response.avoidancePatterns ?? [],
    rawSummary: response.rawSummary ?? "",
    documentId: sample.id,
    chunkCount: chunkAnalyses.length,
    driftedChunks,
    driftRatio,
  };
}
