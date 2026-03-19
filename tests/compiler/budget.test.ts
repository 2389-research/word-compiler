import { describe, expect, it } from "vitest";
import { enforceBudget } from "../../src/compiler/budget.js";
import type { RingSection } from "../../src/types/index.js";
import { createDefaultCompilationConfig } from "../../src/types/index.js";

function makeSection(name: string, wordCount: number, priority: number, immune: boolean): RingSection {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ");
  return { name, text: words, priority, immune };
}

const config = createDefaultCompilationConfig();

describe("enforceBudget", () => {
  it("under budget → unchanged", () => {
    const r1 = [makeSection("A", 5, 0, true)];
    const r3 = [makeSection("B", 5, 0, true)];
    const available = 1000;

    const result = enforceBudget(r1, r3, available, config);
    expect(result.wasCompressed).toBe(false);
    expect(result.r1Sections).toHaveLength(1);
    expect(result.r3Sections).toHaveLength(1);
  });

  it("slightly over → exemplars removed first (highest priority)", () => {
    const r1 = [
      makeSection("KILL_LIST", 10, 0, true),
      makeSection("EXEMPLARS", 50, 6, false),
      makeSection("VOCAB", 10, 4, false),
    ];
    const r3 = [makeSection("CONTRACT", 10, 0, true)];

    // Total ≈ (10+50+10+10)*1.3 = 104 tokens. Set budget to 60.
    const result = enforceBudget(r1, r3, 60, config);

    expect(result.wasCompressed).toBe(true);
    // Exemplars (priority 6) should be removed first
    const r1Names = result.r1Sections.map((s) => s.name);
    expect(r1Names).not.toContain("EXEMPLARS");
    expect(r1Names).toContain("KILL_LIST");
  });

  it("significantly over → multiple Ring 1 sections removed in priority order", () => {
    const r1 = [
      makeSection("KILL_LIST", 5, 0, true),
      makeSection("EXEMPLARS", 30, 6, false),
      makeSection("METAPHORS", 30, 5, false),
      makeSection("VOCAB", 30, 4, false),
      makeSection("SENTENCES", 20, 3, false),
    ];
    const r3 = [makeSection("CONTRACT", 5, 0, true)];

    // Set a tight budget that forces removal of multiple sections
    const result = enforceBudget(r1, r3, 25, config);

    expect(result.wasCompressed).toBe(true);
    const r1Names = result.r1Sections.map((s) => s.name);
    // KILL_LIST (immune) must survive
    expect(r1Names).toContain("KILL_LIST");
    // High-priority sections should be removed first
    expect(r1Names).not.toContain("EXEMPLARS");
    expect(r1Names).not.toContain("METAPHORS");
  });

  it("kill list never removed (immune)", () => {
    const r1 = [makeSection("KILL_LIST", 20, 0, true), makeSection("EXEMPLARS", 20, 6, false)];
    const r3 = [makeSection("CONTRACT", 5, 0, true)];

    // Very tight budget — only immune sections should survive
    const result = enforceBudget(r1, r3, 40, config);

    const r1Names = result.r1Sections.map((s) => s.name);
    expect(r1Names).toContain("KILL_LIST");
  });

  it("Ring 3 compressed only when Ring 1 compression insufficient", () => {
    const r1 = [makeSection("KILL_LIST", 10, 0, true)]; // All immune, can't compress
    const r3 = [
      makeSection("CONTRACT", 10, 0, true),
      makeSection("SENSORY", 30, 4, false),
      makeSection("BRIDGE", 20, 3, false),
    ];

    // Budget too tight even for immune-only R1
    const result = enforceBudget(r1, r3, 40, config);

    expect(result.wasCompressed).toBe(true);
    // Ring 3 should have lost some sections
    const r3Names = result.r3Sections.map((s) => s.name);
    expect(r3Names).toContain("CONTRACT"); // immune
    // At least one non-immune should be removed
    expect(r3Names.length).toBeLessThan(3);
  });

  it("scene contract and voice fingerprints never removed from Ring 3", () => {
    const r1 = [makeSection("KILL_LIST", 5, 0, true)];
    const r3 = [
      makeSection("CONTRACT", 10, 0, true),
      makeSection("VOICE_MARCUS", 10, 0, true),
      makeSection("SENSORY", 30, 4, false),
    ];

    const result = enforceBudget(r1, r3, 30, config);

    const r3Names = result.r3Sections.map((s) => s.name);
    expect(r3Names).toContain("CONTRACT");
    expect(r3Names).toContain("VOICE_MARCUS");
  });

  it("Ring 2 sections under budget pass through unchanged", () => {
    const r1 = [makeSection("KILL_LIST", 5, 0, true)];
    const r2 = [makeSection("CHAPTER_ARC", 10, 2, false), makeSection("CHAR_STATES", 10, 3, false)];
    const r3 = [makeSection("CONTRACT", 5, 0, true)];
    const result = enforceBudget(r1, r3, 1000, config, r2);
    expect(result.wasCompressed).toBe(false);
    expect(result.r2Sections).toHaveLength(2);
    expect(result.r2Sections!.map((s) => s.name)).toEqual(["CHAPTER_ARC", "CHAR_STATES"]);
  });

  it("Ring 2 compressed when Ring 1 compression insufficient (all R1 immune)", () => {
    const r1 = [makeSection("KILL_LIST", 10, 0, true)];
    const r2 = [makeSection("CHAPTER_ARC", 20, 2, false), makeSection("CHAR_STATES", 20, 3, false)];
    const r3 = [makeSection("CONTRACT", 10, 0, true)];
    const result = enforceBudget(r1, r3, 45, config, r2);
    expect(result.wasCompressed).toBe(true);
    const r2Names = result.r2Sections?.map((s) => s.name) ?? [];
    expect(r2Names).not.toContain("CHAR_STATES");
  });

  it("Ring 3 compressed when Ring 1 + Ring 2 compression insufficient (all R1+R2 immune)", () => {
    const r1 = [makeSection("KILL_LIST", 10, 0, true)];
    const r2 = [makeSection("CHAPTER_ARC", 10, 0, true)];
    const r3 = [
      makeSection("CONTRACT", 5, 0, true),
      makeSection("SENSORY", 30, 4, false),
      makeSection("BRIDGE", 20, 3, false),
    ];
    const result = enforceBudget(r1, r3, 35, config, r2);
    expect(result.wasCompressed).toBe(true);
    const r3Names = result.r3Sections.map((s) => s.name);
    expect(r3Names).toContain("CONTRACT");
    expect(r3Names.length).toBeLessThan(3);
  });

  it("Ring 1 hard cap enforced regardless of total budget", () => {
    const bigSection = makeSection("METAPHORS", 200, 5, false);
    const r1 = [makeSection("KILL_LIST", 5, 0, true), bigSection];
    const r3 = [makeSection("CONTRACT", 5, 0, true)];

    const tightConfig = { ...config, ring1HardCap: 20 };
    const result = enforceBudget(r1, r3, 100000, tightConfig);

    expect(result.compressionLog.some((l) => l.includes("hard cap"))).toBe(true);
  });
});
