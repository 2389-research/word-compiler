import type Anthropic from "@anthropic-ai/sdk";
import { buildStage5Prompt, STAGE5_SYSTEM } from "../../src/profile/prompts.js";
import type {
  CrossDocumentResult,
  FilteredFeature,
  FilterResponse,
  PipelineConfig,
  VoiceGuide,
} from "../../src/profile/types.js";
import { textCall } from "./llm.js";

/**
 * Extract FOR GENERATION, FOR EDITING, and CONFIDENCE NOTES sections from
 * the voice guide prose text. Falls back to sensible defaults if sections
 * are not found.
 */
export function extractSections(guideText: string): { generation: string; editing: string; confidence: string } {
  const generationMatch = guideText.match(/FOR GENERATION:\s*([\s\S]*?)(?=FOR EDITING)/i);
  const editingMatch = guideText.match(/FOR EDITING:\s*([\s\S]*?)(?=\d+\.\s|CONFIDENCE NOTES)/i);
  const confidenceMatch = guideText.match(/CONFIDENCE NOTES\s*([\s\S]*?)$/i);

  return {
    generation: generationMatch?.[1]?.trim() ?? "Follow the voice guide features when generating new text.",
    editing: editingMatch?.[1]?.trim() ?? "Check text against the identified voice features during editing.",
    confidence: confidenceMatch?.[1]?.trim() ?? "Confidence levels are indicated per-feature above.",
  };
}

interface CategorizedFeatures {
  core: FilteredFeature[];
  probable: FilteredFeature[];
  avoidance: FilteredFeature[];
  domainSpecific: FilteredFeature[];
  flagged: FilteredFeature[];
}

function categorizeFeatures(features: FilteredFeature[]): CategorizedFeatures {
  const result: CategorizedFeatures = { core: [], probable: [], avoidance: [], domainSpecific: [], flagged: [] };
  for (const feature of features) {
    if (feature.domainFilterDecision === "filter") {
      result.domainSpecific.push(feature);
    } else if (feature.domainFilterDecision === "flag_for_shedding") {
      result.flagged.push(feature);
    } else if (feature.isAvoidancePattern) {
      result.avoidance.push(feature);
    } else if (feature.confidence === "low") {
      result.probable.push(feature);
    } else {
      result.core.push(feature);
    }
  }
  return result;
}

function countConfidenceLevels(features: FilteredFeature[]): { high: number; medium: number; low: number } {
  const kept = features.filter((f) => f.domainFilterDecision !== "filter");
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const f of kept) {
    if (f.confidence === "high") high++;
    else if (f.confidence === "medium") medium++;
    else low++;
  }
  return { high, medium, low };
}

export async function generateVoiceGuide(
  filterResult: FilterResponse,
  crossDoc: CrossDocumentResult,
  nDocuments: number,
  config: PipelineConfig,
  client: Anthropic,
): Promise<VoiceGuide> {
  const cats = categorizeFeatures(filterResult.filteredFeatures);
  const counts = countConfidenceLevels(filterResult.filteredFeatures);
  const needsNewObjectNames = filterResult.filteredFeatures.filter((f) => f.needsNewObject).map((f) => f.featureName);

  const allRelevant = [...cats.core, ...cats.probable, ...cats.avoidance, ...cats.flagged];
  const featuresJson = JSON.stringify(allRelevant, null, 2);

  const prompt = buildStage5Prompt(
    featuresJson,
    nDocuments,
    config.sourceDomain,
    config.targetDomain,
    counts.high,
    counts.medium,
    counts.low,
    needsNewObjectNames,
  );

  const guideText = await textCall(client, config.stage5GuideModel, STAGE5_SYSTEM, prompt);
  const { generation, editing, confidence } = extractSections(guideText);

  const domains = new Set<string>();
  if (config.sourceDomain) domains.add(config.sourceDomain);
  if (config.targetDomain) domains.add(config.targetDomain);

  const now = new Date().toISOString();

  console.log(
    `[stage5] Guide assembled: ${cats.core.length} core, ${cats.avoidance.length} avoidance, ${cats.probable.length} probable, ${cats.domainSpecific.length} domain-specific`,
  );

  return {
    version: "1.0.0",
    versionHistory: [
      {
        version: "1.0.0",
        updatedAt: now,
        changeReason: "Initial voice guide generation",
        changeSummary: `Generated from ${nDocuments} documents. ${cats.core.length} core features, ${cats.probable.length} probable features, ${cats.avoidance.length} avoidance patterns identified.`,
        confirmedFeatures: cats.core.map((f) => f.featureName),
        contradictedFeatures: [],
        newFeatures: [...cats.core, ...cats.probable, ...cats.avoidance].map((f) => f.featureName),
      },
    ],
    corpusSize: nDocuments,
    domainsRepresented: [...domains],
    coreFeatures: cats.core,
    probableFeatures: cats.probable,
    formatVariantFeatures: crossDoc.formatVariantFeatures,
    domainSpecificFeatures: cats.domainSpecific,
    avoidancePatterns: cats.avoidance,
    narrativeSummary: guideText,
    generationInstructions: generation,
    editingInstructions: editing,
    confidenceNotes: confidence,
    updatedAt: now,
  };
}
