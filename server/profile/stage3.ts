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
  const validDocs = docAnalyses.filter((doc) => doc.driftRatio <= config.driftExclusionThreshold);

  if (validDocs.length === 0) {
    throw new Error(
      `[stage3] All ${docAnalyses.length} documents exceeded drift exclusion threshold (${config.driftExclusionThreshold}). Cannot cluster.`,
    );
  }

  const docAnalysesJson = JSON.stringify(validDocs, null, 2);
  const prompt = buildStage3Prompt(docAnalysesJson, validDocs.length);

  return structuredCall<CrossDocumentResult>(
    client,
    config.stage3ClusterModel,
    STAGE3_SYSTEM,
    prompt,
    CROSS_DOCUMENT_SCHEMA,
    "cross_document_clustering",
  );
}
