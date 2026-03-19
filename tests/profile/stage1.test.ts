import { describe, expect, it } from "vitest";
import type { DocumentChunk } from "@/profile/types.js";
import { createDefaultPipelineConfig } from "@/profile/types.js";
import { analyzeChunks } from "../../server/profile/stage1.js";

describe("analyzeChunks", () => {
  it("skips chunks below minimum token count", async () => {
    const tinyChunk: DocumentChunk = {
      text: "Hi",
      index: 0,
      total: 1,
      isFirst: true,
      isLast: true,
      overlapPrev: null,
      overlapNext: null,
      tokenCount: 5,
    };
    const config = createDefaultPipelineConfig();
    const mockClient = {} as any;
    const results = await analyzeChunks("doc1", [tinyChunk], config, mockClient);
    expect(results).toHaveLength(0);
  });

  it("returns empty array when all chunks are too small", async () => {
    const chunks: DocumentChunk[] = [
      {
        text: "a",
        index: 0,
        total: 2,
        isFirst: true,
        isLast: false,
        overlapPrev: null,
        overlapNext: null,
        tokenCount: 10,
      },
      {
        text: "b",
        index: 1,
        total: 2,
        isFirst: false,
        isLast: true,
        overlapPrev: null,
        overlapNext: null,
        tokenCount: 20,
      },
    ];
    const config = createDefaultPipelineConfig();
    const mockClient = {} as any;
    const results = await analyzeChunks("doc1", chunks, config, mockClient);
    expect(results).toHaveLength(0);
  });
});
