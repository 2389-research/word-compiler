import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { distillVoice } from "../../server/profile/projectGuide.js";

// ─── distillVoice: empty sources (no LLM call needed) ────

describe("distillVoice", () => {
  it("returns empty string when all sources are null/empty", async () => {
    // When no sources are provided, distillVoice short-circuits before any LLM call.
    const fakeClient = {} as Anthropic;
    const result = await distillVoice(null, [], null, null, fakeClient);
    expect(result).toBe("");
  });
});
