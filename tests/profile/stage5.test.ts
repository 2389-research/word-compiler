import { describe, expect, it } from "vitest";
import { extractSections } from "../../server/profile/stage5.js";

describe("extractSections", () => {
  it("extracts all three sections", () => {
    const text = `1. THE CORE SENSIBILITY\nA warm writer.\n\n6. HOW TO USE THIS GUIDE\n\nFOR GENERATION:\nWrite warmly.\n\nFOR EDITING:\nCheck cold passages.\n\n7. CONFIDENCE NOTES\nBased on 2 docs.`;
    const { generation, editing, confidence } = extractSections(text);
    expect(generation).toContain("Write warmly");
    expect(editing).toContain("Check cold");
    expect(confidence).toContain("2 docs");
  });
  it("returns fallbacks when sections not found", () => {
    const { generation, editing, confidence } = extractSections("Just text.");
    expect(generation).toBeTruthy();
    expect(editing).toBeTruthy();
    expect(confidence).toBeTruthy();
  });

  it("extracts markdown-style sections with numbered content inside", () => {
    const text = `## How to Use This Guide

### Generation Instructions

**Primer:** Write warmly and directly.

**Three patterns:**
1. Ground abstractions
2. Hold contradictions
3. Use restraint

### Editing Instructions

**Red flags:**

1. **Melodramatic language**: Exclamation points, breathless fragments.
2. **Thematic declaration**: Stating what the story means.
3. **Simplified judgment**: Characters without interiority.

**On-voice question:** Is this grounded in concrete detail?

## Confidence Notes

### High Confidence
These are bedrock features.`;

    const { generation, editing, confidence } = extractSections(text);
    expect(generation).toContain("Write warmly");
    expect(generation).toContain("Ground abstractions");
    expect(editing).toContain("Melodramatic language");
    expect(editing).toContain("Thematic declaration");
    expect(editing).toContain("On-voice question");
    expect(confidence).toContain("bedrock features");
  });
});
