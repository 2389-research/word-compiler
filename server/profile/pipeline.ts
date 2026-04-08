import type Anthropic from "@anthropic-ai/sdk";
import { chunkDocument } from "../../src/profile/chunker.js";
import type { PipelineConfig, VoiceGuide, WritingSample } from "../../src/profile/types.js";
import { analyzeChunks } from "./stage1.js";
import { synthesizeDocument } from "./stage2.js";
import { clusterDocuments } from "./stage3.js";
import { filterFeatures } from "./stage4.js";
import { generateVoiceGuide } from "./stage5.js";

/** Select representative excerpts from writing samples for Ring 1 few-shot voice matching. */
function selectRepresentativeExcerpts(samples: WritingSample[]): string | undefined {
  const excerptTarget = 1500; // tokens (~1100 words)
  const sortedSamples = [...samples].sort((a, b) => b.wordCount - a.wordCount);
  const excerpts: string[] = [];
  let excerptTokens = 0;
  for (const sample of sortedSamples.slice(0, 3)) {
    const paragraphs = sample.text.split(/\n\n+/).filter((p) => p.trim().length > 50);
    const firstParagraph = paragraphs[0];
    if (firstParagraph) {
      const tokens = firstParagraph.split(/\s+/).length * 1.3;
      if (excerptTokens + tokens <= excerptTarget) {
        excerpts.push(firstParagraph.trim());
        excerptTokens += tokens;
      }
    }
  }
  if (excerpts.length > 0) {
    console.log(`[profile] Selected ${excerpts.length} representative excerpts (${Math.round(excerptTokens)} tokens)`);
    return excerpts.join("\n\n---\n\n");
  }
  return undefined;
}

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
    console.log(
      `[profile] Stage 1: analyzing ${chunks.length} chunks for "${sample.filename ?? sample.id}" (${sample.wordCount} words)`,
    );
    const analyses = await analyzeChunks(sample.id, chunks, config, client);
    const highDriftCount = analyses.filter((a) => a.contentDriftScore >= 0.5).length;
    console.log(
      `[profile] Stage 1 done: ${analyses.length} chunks analyzed, ${highDriftCount} with drift score >= 0.5`,
    );
    for (const a of analyses) {
      if (a.contentDriftScore > 0) {
        console.log(
          `[profile]   chunk ${a.chunkIndex} drift=${a.contentDriftScore.toFixed(2)}: ${a.contentDriftNote ?? "no note"}`,
        );
      }
    }
    chunkAnalysesPerDoc.push({ sample, analyses });
  }

  // Stage 2: Synthesize each document
  const docAnalyses = [];
  for (const { sample, analyses } of chunkAnalysesPerDoc) {
    console.log(`[profile] Stage 2: synthesizing "${sample.filename ?? sample.id}"`);
    const docAnalysis = await synthesizeDocument(sample, analyses, config, client);
    console.log(
      `[profile] Stage 2 done: driftRatio=${docAnalysis.driftRatio.toFixed(2)}, ${docAnalysis.consistentFeatures?.length ?? 0} consistent features, ${docAnalysis.avoidancePatterns?.length ?? 0} avoidance patterns`,
    );
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

  const excerpts = selectRepresentativeExcerpts(samples);
  if (excerpts) {
    voiceGuide.representativeExcerpts = excerpts;
  }

  console.log(`[profile] Pipeline complete`);
  return voiceGuide;
}
