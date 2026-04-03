import { DEFAULT_ANALYSIS_MODEL, DEFAULT_FAST_MODEL } from "../types/metadata.js";
import { generateId } from "../types/utils.js";

// ─── Input Types ───────────────────────────────────────

export interface WritingSample {
  id: string;
  filename: string | null;
  domain: string;
  wordCount: number;
  text: string;
  createdAt: string;
}

export interface DocumentMetadata {
  domain: string | null;
  publication: string | null;
  date: string | null;
  wordCount: number | null;
  format: string | null;
}

export interface DocumentChunk {
  text: string;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  overlapPrev: string | null;
  overlapNext: string | null;
  tokenCount: number;
}

// ─── Stage 1: Chunk Analysis ──────────────────────────

export interface ChunkAnalysisResponse {
  readerRelationship: string;
  complexityHandling: string;
  emotionalTexture: string;
  openPattern: string | null;
  closePattern: string | null;
  personalityLeakage: string;
  violationTest: string;
  avoidancePatterns: string[];
  domainAgnosticFeatures: string[];
  contentDriftScore: number;
  contentDriftNote: string | null;
}

export interface ChunkAnalysis extends ChunkAnalysisResponse {
  documentId: string;
  chunkIndex: number;
}

// ─── Stage 2: Document Synthesis ──────────────────────

export interface StyleFeature {
  name: string;
  description: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface FormatVariantFeature {
  name: string;
  description: string;
  formatCondition: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface DocumentSynthesisResponse {
  consistentFeatures: StyleFeature[];
  variableFeatures: FormatVariantFeature[];
  dominantVoiceMarkers: string[];
  structuralPatterns: string[];
  avoidancePatterns: string[];
  rawSummary: string;
}

export interface DocumentAnalysis extends DocumentSynthesisResponse {
  documentId: string;
  chunkCount: number;
  driftedChunks: number[];
  driftRatio: number;
}

// ─── Stage 3: Cross-Document Clustering ───────────────

export interface ClusterResult {
  featureName: string;
  description: string;
  documentCount: number;
  totalDocuments: number;
  evidenceExamples: string[];
  confidence: "high" | "medium" | "low";
  transferability: "transferable" | "domain_specific" | "uncertain";
  transferabilityRationale: string;
  isAvoidancePattern: boolean;
}

export interface DomainArtifact {
  name: string;
  description: string;
  evidence: string;
}

export interface CrossDocumentResult {
  stableFeatures: ClusterResult[];
  formatVariantFeatures: FormatVariantFeature[];
  domainArtifacts: DomainArtifact[];
  evolutionNotes: string | null;
}

// ─── Stage 4: Domain Filtering ────────────────────────

export interface FilteredFeature extends ClusterResult {
  domainFilterDecision: "keep" | "filter" | "flag_for_shedding";
  filterRationale: string;
  needsNewObject: boolean;
  newObjectNote: string | null;
}

export interface FilterResponse {
  filteredFeatures: FilteredFeature[];
}

// ─── Stage 5: Voice Guide ─────────────────────────────

export interface VoiceGuideVersion {
  version: string;
  updatedAt: string;
  changeReason: string;
  changeSummary: string;
  confirmedFeatures: string[];
  contradictedFeatures: string[];
  newFeatures: string[];
}

export interface VoiceGuide {
  version: string;
  versionHistory: VoiceGuideVersion[];
  corpusSize: number;
  domainsRepresented: string[];
  coreFeatures: FilteredFeature[];
  probableFeatures: FilteredFeature[];
  formatVariantFeatures: FormatVariantFeature[];
  domainSpecificFeatures: FilteredFeature[];
  avoidancePatterns: FilteredFeature[];
  narrativeSummary: string;
  generationInstructions: string;
  editingInstructions: string;
  confidenceNotes: string;
  ring1Injection: string;
  updatedAt: string;
}

// ─── CIPHER Edit Learning ────────────────────────────

export interface SignificantEdit {
  id: string;
  projectId: string;
  chunkId: string;
  originalText: string;
  editedText: string;
  processed: boolean;
  createdAt: string;
}

export interface PreferenceStatement {
  id: string;
  projectId: string;
  statement: string;
  editCount: number;
  createdAt: string;
}

// ─── Config ───────────────────────────────────────────

export interface PipelineConfig {
  stage1ChunkModel: string;
  stage2DocumentModel: string;
  stage3ClusterModel: string;
  stage4FilterModel: string;
  stage5GuideModel: string;
  chunkTargetTokens: number;
  chunkOverlapTokens: number;
  minChunkTokens: number;
  parallelChunkCalls: number;
  batchSize: number;
  firstLastChunkWeight: number;
  sourceDomain: string;
  targetDomain: string;
  driftDownweightFactor: number;
  driftDownweightThreshold: number;
  driftExclusionThreshold: number;
}

// ─── Factory Functions ────────────────────────────────

export function createEmptyVoiceGuide(): VoiceGuide {
  return {
    version: "0.0.0",
    versionHistory: [],
    corpusSize: 0,
    domainsRepresented: [],
    coreFeatures: [],
    probableFeatures: [],
    formatVariantFeatures: [],
    domainSpecificFeatures: [],
    avoidancePatterns: [],
    narrativeSummary: "",
    generationInstructions: "",
    editingInstructions: "",
    confidenceNotes: "",
    ring1Injection: "",
    updatedAt: new Date().toISOString(),
  };
}

export function createWritingSample(filename: string | null, domain: string, text: string): WritingSample {
  return {
    id: generateId(),
    filename,
    domain,
    wordCount: text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length,
    text,
    createdAt: new Date().toISOString(),
  };
}

export function createDefaultPipelineConfig(): PipelineConfig {
  return {
    stage1ChunkModel: DEFAULT_FAST_MODEL,
    stage2DocumentModel: DEFAULT_FAST_MODEL,
    stage3ClusterModel: DEFAULT_ANALYSIS_MODEL,
    stage4FilterModel: DEFAULT_ANALYSIS_MODEL,
    stage5GuideModel: DEFAULT_ANALYSIS_MODEL,
    chunkTargetTokens: 10000,
    chunkOverlapTokens: 1000,
    minChunkTokens: 100,
    parallelChunkCalls: 5,
    batchSize: 10,
    firstLastChunkWeight: 1.5,
    sourceDomain: "",
    targetDomain: "literary_fiction",
    driftDownweightFactor: 0.5,
    driftDownweightThreshold: 0.5,
    driftExclusionThreshold: 0.8,
  };
}
