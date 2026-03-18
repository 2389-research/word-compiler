import type Anthropic from "@anthropic-ai/sdk";
import { buildStage4Prompt, STAGE4_SYSTEM } from "../../src/profile/prompts.js";
import type { CrossDocumentResult, FilterResponse, PipelineConfig } from "../../src/profile/types.js";
import { structuredCall } from "./llm.js";

const FILTER_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    filteredFeatures: {
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
          domainFilterDecision: { type: "string" },
          filterRationale: { type: "string" },
          needsNewObject: { type: "boolean" },
          newObjectNote: { type: ["string", "null"] },
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
          "domainFilterDecision",
          "filterRationale",
          "needsNewObject",
          "newObjectNote",
        ],
      },
    },
  },
  required: ["filteredFeatures"],
};

export async function filterFeatures(
  crossDoc: CrossDocumentResult,
  config: PipelineConfig,
  client: Anthropic,
): Promise<FilterResponse> {
  const featuresJson = JSON.stringify(crossDoc.stableFeatures, null, 2);
  const prompt = buildStage4Prompt(featuresJson, config.sourceDomain, config.targetDomain);

  return structuredCall<FilterResponse>(
    client,
    config.stage4FilterModel,
    STAGE4_SYSTEM,
    prompt,
    FILTER_RESPONSE_SCHEMA,
    "domain_filter",
  );
}
