import { describe, expect, it } from "vitest";
import { chunkDocument } from "@/profile/chunker.js";
import { createDefaultPipelineConfig, createWritingSample } from "@/profile/types.js";

describe("pipeline orchestration", () => {
  it("chunks writing samples before stage 1", () => {
    const sample = createWritingSample("test.txt", "blog", "Hello world. ".repeat(100));
    const config = createDefaultPipelineConfig();
    const chunks = chunkDocument(sample, config);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.isFirst).toBe(true);
    expect(chunks[chunks.length - 1]!.isLast).toBe(true);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  it("config defaults use Anthropic model names", () => {
    const config = createDefaultPipelineConfig();
    expect(config.stage1ChunkModel).toContain("claude");
    expect(config.stage3ClusterModel).toContain("claude");
    expect(config.stage5GuideModel).toContain("claude");
  });
});
