import type Anthropic from "@anthropic-ai/sdk";
import { chunkDocument } from "../../src/profile/chunker.js";
import type { PipelineConfig, VoiceGuide, WritingSample } from "../../src/profile/types.js";
import { analyzeChunks } from "./stage1.js";
import { synthesizeDocument } from "./stage2.js";
import { clusterDocuments } from "./stage3.js";
import { filterFeatures } from "./stage4.js";
import { generateVoiceGuide } from "./stage5.js";

export async function runPipeline(
  samples: WritingSample[],
  config: PipelineConfig,
  client: Anthropic,
): Promise<VoiceGuide> {
  if (samples.length === 0) {
    throw new Error("[profile] No writing samples provided");
  }

  // Stage 1: Chunk and analyze each document
  const chunkAnalysesPerDoc = [];
  for (const sample of samples) {
    const chunks = chunkDocument(sample, config);
    console.log(`[profile] Stage 1: analyzing ${chunks.length} chunks for document ${sample.id}`);
    const analyses = await analyzeChunks(sample.id, chunks, config, client);
    chunkAnalysesPerDoc.push({ sample, analyses });
  }

  // Stage 2: Synthesize each document
  const docAnalyses = [];
  for (const { sample, analyses } of chunkAnalysesPerDoc) {
    console.log(`[profile] Stage 2: synthesizing document ${sample.id}`);
    const docAnalysis = await synthesizeDocument(sample, analyses, config, client);
    docAnalyses.push(docAnalysis);
  }

  // Stage 3: Cross-document clustering
  console.log(`[profile] Stage 3: clustering ${docAnalyses.length} documents`);
  const crossDoc = await clusterDocuments(docAnalyses, config, client);

  // Stage 4: Filter features
  console.log(`[profile] Stage 4: filtering features`);
  const filterResult = await filterFeatures(crossDoc, config, client);

  // Stage 5: Generate voice guide
  console.log(`[profile] Stage 5: generating voice guide`);
  const voiceGuide = await generateVoiceGuide(filterResult, crossDoc, samples.length, config, client);

  console.log(`[profile] Pipeline complete`);
  return voiceGuide;
}
