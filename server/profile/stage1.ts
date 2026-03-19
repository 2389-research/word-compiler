import type Anthropic from "@anthropic-ai/sdk";
import { buildStage1Prompt, STAGE1_SYSTEM } from "../../src/profile/prompts.js";
import type { ChunkAnalysis, ChunkAnalysisResponse, DocumentChunk, PipelineConfig } from "../../src/profile/types.js";
import { parallelStructuredCalls } from "./llm.js";

const CHUNK_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    readerRelationship: { type: "string" },
    complexityHandling: { type: "string" },
    emotionalTexture: { type: "string" },
    openPattern: { type: ["string", "null"] },
    closePattern: { type: ["string", "null"] },
    personalityLeakage: { type: "string" },
    violationTest: { type: "string" },
    avoidancePatterns: { type: "array", items: { type: "string" } },
    domainAgnosticFeatures: { type: "array", items: { type: "string" } },
    contentDriftScore: {
      type: "number",
      description: "Content drift from 0.0 (pure author voice) to 1.0 (entirely non-author content)",
    },
    contentDriftNote: { type: ["string", "null"] },
  },
  required: [
    "readerRelationship",
    "complexityHandling",
    "emotionalTexture",
    "openPattern",
    "closePattern",
    "personalityLeakage",
    "violationTest",
    "avoidancePatterns",
    "domainAgnosticFeatures",
    "contentDriftScore",
    "contentDriftNote",
  ],
};

export async function analyzeChunks(
  documentId: string,
  chunks: DocumentChunk[],
  config: PipelineConfig,
  client: Anthropic,
): Promise<ChunkAnalysis[]> {
  const validChunks = chunks.filter((chunk) => {
    if (chunk.tokenCount < config.minChunkTokens) {
      console.warn(
        `[stage1] Skipping chunk ${chunk.index} (${chunk.tokenCount} tokens < minimum ${config.minChunkTokens})`,
      );
      return false;
    }
    return true;
  });

  if (validChunks.length === 0) {
    return [];
  }

  const calls = validChunks.map((chunk) => ({
    model: config.stage1ChunkModel,
    system: STAGE1_SYSTEM,
    user: buildStage1Prompt(chunk),
    schema: CHUNK_ANALYSIS_SCHEMA,
    schemaName: "chunk_analysis",
  }));

  const responses = await parallelStructuredCalls<ChunkAnalysisResponse>(calls, client, config.parallelChunkCalls);

  return responses.map((response, i) => ({
    ...response,
    documentId,
    chunkIndex: validChunks[i]!.index,
  }));
}
