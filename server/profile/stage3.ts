import type Anthropic from "@anthropic-ai/sdk";
import { buildStage3Prompt, STAGE3_SYSTEM } from "../../src/profile/prompts.js";
import type { CrossDocumentResult, DocumentAnalysis, PipelineConfig } from "../../src/profile/types.js";
import { structuredCall } from "./llm.js";

const CROSS_DOCUMENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    stableFeatures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          featureName: { type: "string" },
          description: { type: "string" },
          documentCount: { type: "number" },
          totalDocuments: { type: "number" },
          evidenceExamples: { type: "array", items: { type: "string" } },
          confidence: { type: "string" },
          transferability: { type: "string" },
          transferabilityRationale: { type: "string" },
          isAvoidancePattern: { type: "boolean" },
        },
        required: [
          "featureName",
          "description",
          "documentCount",
          "totalDocuments",
          "evidenceExamples",
          "confidence",
          "transferability",
          "transferabilityRationale",
          "isAvoidancePattern",
        ],
      },
    },
    formatVariantFeatures: {
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
    domainArtifacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["name", "description", "evidence"],
      },
    },
    evolutionNotes: { type: ["string", "null"] },
  },
  required: ["stableFeatures", "formatVariantFeatures", "domainArtifacts", "evolutionNotes"],
};

export async function clusterDocuments(
  docAnalyses: DocumentAnalysis[],
  config: PipelineConfig,
  client: Anthropic,
): Promise<CrossDocumentResult> {
  // Try strict filtering first
  let activeDocs = docAnalyses.filter((doc) => doc.driftRatio <= config.driftExclusionThreshold);

  if (activeDocs.length === 0) {
    // Fallback: use ALL documents but log a warning. The drift threshold was too aggressive
    // for this corpus — better to produce a lower-confidence guide than nothing.
    console.warn(
      `[stage3] All ${docAnalyses.length} documents exceeded drift threshold (${config.driftExclusionThreshold}). ` +
        "Proceeding with all documents — results will have lower confidence.",
    );
    activeDocs = docAnalyses;
  }

  console.log(
    `[stage3] Clustering ${activeDocs.length} documents (${docAnalyses.length - activeDocs.length} excluded by drift)`,
  );

  const docAnalysesJson = JSON.stringify(activeDocs, null, 2);
  const prompt = buildStage3Prompt(docAnalysesJson, activeDocs.length);

  const result = await structuredCall<CrossDocumentResult>(
    client,
    config.stage3ClusterModel,
    STAGE3_SYSTEM,
    prompt,
    CROSS_DOCUMENT_SCHEMA,
    "cross_document_clustering",
  );

  console.log(`[stage3] Raw result keys: ${Object.keys(result).join(", ")}`);
  console.log(
    `[stage3] Found ${result.stableFeatures?.length ?? 0} stable features, ${result.formatVariantFeatures?.length ?? 0} format variants, ${result.domainArtifacts?.length ?? 0} domain artifacts`,
  );

  // Defensive: ensure arrays exist even if LLM omitted them
  if (!result.stableFeatures) result.stableFeatures = [];
  if (!result.formatVariantFeatures) result.formatVariantFeatures = [];
  if (!result.domainArtifacts) result.domainArtifacts = [];

  return result;
}
