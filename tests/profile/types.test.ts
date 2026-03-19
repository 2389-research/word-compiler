import { describe, expect, it } from "vitest";
import { createDefaultPipelineConfig, createEmptyVoiceGuide, createWritingSample } from "../../src/profile/types.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("createEmptyVoiceGuide", () => {
  it("returns version 0.0.0", () => {
    const guide = createEmptyVoiceGuide();
    expect(guide.version).toBe("0.0.0");
  });

  it("returns empty arrays for all feature collections", () => {
    const guide = createEmptyVoiceGuide();
    expect(guide.coreFeatures).toEqual([]);
    expect(guide.probableFeatures).toEqual([]);
    expect(guide.formatVariantFeatures).toEqual([]);
    expect(guide.domainSpecificFeatures).toEqual([]);
    expect(guide.avoidancePatterns).toEqual([]);
    expect(guide.versionHistory).toEqual([]);
    expect(guide.domainsRepresented).toEqual([]);
  });

  it("returns zero corpus size", () => {
    const guide = createEmptyVoiceGuide();
    expect(guide.corpusSize).toBe(0);
  });

  it("returns empty strings for narrative fields", () => {
    const guide = createEmptyVoiceGuide();
    expect(guide.narrativeSummary).toBe("");
    expect(guide.generationInstructions).toBe("");
    expect(guide.editingInstructions).toBe("");
    expect(guide.confidenceNotes).toBe("");
  });

  it("returns empty ring1Injection", () => {
    const guide = createEmptyVoiceGuide();
    expect(guide.ring1Injection).toBe("");
  });

  it("sets updatedAt to a valid ISO string", () => {
    const guide = createEmptyVoiceGuide();
    expect(new Date(guide.updatedAt).toISOString()).toBe(guide.updatedAt);
  });
});

describe("createWritingSample", () => {
  it("generates a valid UUID id", () => {
    const sample = createWritingSample("test.txt", "blog", "Hello world");
    expect(sample.id).toMatch(UUID_REGEX);
  });

  it("computes word count from text", () => {
    const sample = createWritingSample(null, "essay", "one two three four five");
    expect(sample.wordCount).toBe(5);
  });

  it("handles multi-whitespace word count", () => {
    const sample = createWritingSample(null, "essay", "  spaced   out  words  ");
    expect(sample.wordCount).toBe(3);
  });

  it("stores filename and domain", () => {
    const sample = createWritingSample("draft.md", "fiction", "Some text here");
    expect(sample.filename).toBe("draft.md");
    expect(sample.domain).toBe("fiction");
  });

  it("allows null filename", () => {
    const sample = createWritingSample(null, "fiction", "Some text here");
    expect(sample.filename).toBeNull();
  });

  it("sets createdAt to a valid ISO string", () => {
    const sample = createWritingSample("f.txt", "blog", "text");
    expect(new Date(sample.createdAt).toISOString()).toBe(sample.createdAt);
  });

  it("stores the full text", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const sample = createWritingSample(null, "prose", text);
    expect(sample.text).toBe(text);
  });
});

describe("createDefaultPipelineConfig", () => {
  it("uses haiku for stage 1 and 2 models", () => {
    const config = createDefaultPipelineConfig();
    expect(config.stage1ChunkModel).toBe("claude-haiku-4-5-20251001");
    expect(config.stage2DocumentModel).toBe("claude-haiku-4-5-20251001");
  });

  it("uses sonnet for stage 3-5 models", () => {
    const config = createDefaultPipelineConfig();
    expect(config.stage3ClusterModel).toBe("claude-sonnet-4-5-20250929");
    expect(config.stage4FilterModel).toBe("claude-sonnet-4-5-20250929");
    expect(config.stage5GuideModel).toBe("claude-sonnet-4-5-20250929");
  });

  it("returns correct chunking defaults", () => {
    const config = createDefaultPipelineConfig();
    expect(config.chunkTargetTokens).toBe(10000);
    expect(config.chunkOverlapTokens).toBe(1000);
    expect(config.minChunkTokens).toBe(100);
  });

  it("returns correct processing defaults", () => {
    const config = createDefaultPipelineConfig();
    expect(config.parallelChunkCalls).toBe(5);
    expect(config.batchSize).toBe(10);
    expect(config.firstLastChunkWeight).toBe(1.5);
  });

  it("returns correct domain defaults", () => {
    const config = createDefaultPipelineConfig();
    expect(config.sourceDomain).toBe("");
    expect(config.targetDomain).toBe("literary_fiction");
  });

  it("returns correct drift defaults", () => {
    const config = createDefaultPipelineConfig();
    expect(config.driftDownweightFactor).toBe(0.5);
    expect(config.driftDownweightThreshold).toBe(0.5);
    expect(config.driftExclusionThreshold).toBe(0.8);
  });
});
