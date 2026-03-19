import { describe, expect, it } from "vitest";
import { chunkDocument } from "@/profile/chunker.js";
import { buildStage1Prompt, STAGE1_SYSTEM } from "@/profile/prompts.js";
import { extractCoreSensibility, renderEditingFragment, renderGenerationFragment } from "@/profile/renderer.js";
import { createDefaultPipelineConfig, createEmptyVoiceGuide, createWritingSample } from "@/profile/types.js";

describe("profile pipeline integration", () => {
  it("chunking → prompts → types chain produces valid data", () => {
    const sample = createWritingSample("blog1.txt", "blog", "A substantial blog post about writing. ".repeat(200));
    const config = createDefaultPipelineConfig();
    const chunks = chunkDocument(sample, config);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.text.length).toBeGreaterThan(0);

    // Verify prompts can be built from chunks
    const prompt = buildStage1Prompt(chunks[0]!);
    expect(prompt).toContain("Chunk 1");
    expect(prompt).toContain("writing");
    expect(STAGE1_SYSTEM.length).toBeGreaterThan(0);
  });

  it("VoiceGuide → renderer produces injectable fragments", () => {
    const guide = createEmptyVoiceGuide();
    guide.narrativeSummary =
      "1. THE CORE SENSIBILITY\nA warm, direct writer who values clarity.\n\n2. WHAT THEY DO\nThey write directly.";
    guide.generationInstructions = "Write as if speaking to a friend.";
    guide.editingInstructions = "Watch for formal, cold passages.";

    const genFragment = renderGenerationFragment(guide);
    const editFragment = renderEditingFragment(guide);

    // Fragments should be injectable into Ring 1
    expect(genFragment).toContain("Write as if speaking to a friend.");
    expect(genFragment).toContain("FULL VOICE GUIDE");
    expect(editFragment).toContain("Watch for formal, cold passages.");
    expect(editFragment).toContain("CORE SENSIBILITY");

    // Core sensibility extraction works
    const core = extractCoreSensibility(guide.narrativeSummary);
    expect(core).toContain("warm, direct writer");
    expect(core).not.toContain("WHAT THEY DO");
  });

  it("config defaults use Anthropic model names", () => {
    const config = createDefaultPipelineConfig();
    expect(config.stage1ChunkModel).toContain("claude");
    expect(config.stage3ClusterModel).toContain("claude");
    expect(config.stage5GuideModel).toContain("claude");
  });
});
