import { describe, expect, it } from "vitest";
import {
  applyProfileToCharacter,
  buildProfileExtractionPrompt,
  type ExtractedProfile,
  parseProfileResponse,
} from "../../src/bootstrap/index.js";
import { createEmptyCharacterDossier } from "../../src/types/index.js";

describe("buildProfileExtractionPrompt", () => {
  it("produces a CompiledPayload with all samples in user message", () => {
    const payload = buildProfileExtractionPrompt(["Sample one text.", "Sample two text.", "Sample three text."]);
    expect(payload.systemMessage).toContain("voice analyst");
    expect(payload.userMessage).toContain("Sample one text.");
    expect(payload.userMessage).toContain("Sample two text.");
    expect(payload.userMessage).toContain("Sample three text.");
    expect(payload.userMessage).toContain("SAMPLE 1");
    expect(payload.userMessage).toContain("SAMPLE 3");
  });

  it("works with a single sample", () => {
    const payload = buildProfileExtractionPrompt(["Just one passage here."]);
    expect(payload.userMessage).toContain("Just one passage here.");
    expect(payload.userMessage).toContain("SAMPLE 1");
  });

  it("throws on empty samples array", () => {
    expect(() => buildProfileExtractionPrompt([])).toThrow("At least one writing sample is required");
  });
});

describe("parseProfileResponse", () => {
  const validProfile: ExtractedProfile = {
    vocabularyNotes: "Direct, punchy, uses tech jargon sparingly",
    writingTics: ["em dashes", "parentheticals", "sentence fragments"],
    metaphoricRegister: "engineering and construction",
    prohibitedLanguage: ["delve", "landscape", "robust"],
    sentenceLengthRange: [4, 30],
    argumentativeStyle: "Leads with the strongest claim, then backs it up",
    rhetoricalApproach: "Direct address, concrete examples",
    observationalFocus: "Power dynamics and incentive structures",
    persuasionStyle: "Accumulates evidence until conclusion feels inevitable",
    emotionalRegister: "Controlled urgency, not angry but clearly alarmed",
    writingSamples: ["The whole thing is a mess.", "Nobody at the wheel."],
  };

  it("parses valid JSON response", () => {
    const result = parseProfileResponse(JSON.stringify(validProfile));
    expect(result).toEqual(validProfile);
  });

  it("handles markdown-fenced JSON", () => {
    const result = parseProfileResponse("```json\n" + JSON.stringify(validProfile) + "\n```");
    expect(result).toEqual(validProfile);
  });

  it("returns error for malformed JSON", () => {
    const result = parseProfileResponse("not json at all");
    expect("error" in result).toBe(true);
  });
});

describe("applyProfileToCharacter", () => {
  const profile: ExtractedProfile = {
    vocabularyNotes: "Direct and punchy",
    writingTics: ["em dashes", "fragments"],
    metaphoricRegister: "engineering",
    prohibitedLanguage: ["delve"],
    sentenceLengthRange: [3, 25],
    argumentativeStyle: "Leads with claims",
    rhetoricalApproach: "Direct address",
    observationalFocus: "Power dynamics",
    persuasionStyle: "Evidence accumulation",
    emotionalRegister: "Controlled urgency",
    writingSamples: ["Sample passage one.", "Sample passage two."],
  };

  it("fills empty voice fields from profile", () => {
    const char = createEmptyCharacterDossier("Author");
    const updated = applyProfileToCharacter(char, profile);
    expect(updated.voice.vocabularyNotes).toBe("Direct and punchy");
    expect(updated.voice.verbalTics).toEqual(["em dashes", "fragments"]);
    expect(updated.voice.metaphoricRegister).toBe("engineering");
    expect(updated.voice.prohibitedLanguage).toEqual(["delve"]);
    expect(updated.voice.sentenceLengthRange).toEqual([3, 25]);
    expect(updated.voice.dialogueSamples).toEqual(["Sample passage one.", "Sample passage two."]);
  });

  it("fills empty behavior fields from profile", () => {
    const char = createEmptyCharacterDossier("Author");
    const updated = applyProfileToCharacter(char, profile);
    expect(updated.behavior?.stressResponse).toBe("Leads with claims");
    expect(updated.behavior?.socialPosture).toBe("Direct address");
    expect(updated.behavior?.noticesFirst).toBe("Power dynamics");
    expect(updated.behavior?.lyingStyle).toBe("Evidence accumulation");
    expect(updated.behavior?.emotionPhysicality).toBe("Controlled urgency");
  });

  it("does NOT overwrite existing non-empty fields", () => {
    const char = createEmptyCharacterDossier("Author");
    char.voice.vocabularyNotes = "Already set by user";
    char.voice.verbalTics = ["user tic"];
    const updated = applyProfileToCharacter(char, profile);
    expect(updated.voice.vocabularyNotes).toBe("Already set by user");
    expect(updated.voice.verbalTics).toEqual(["user tic"]);
    // But empty fields still get filled
    expect(updated.voice.metaphoricRegister).toBe("engineering");
  });

  it("does not mutate the original character", () => {
    const char = createEmptyCharacterDossier("Author");
    const original = structuredClone(char);
    applyProfileToCharacter(char, profile);
    expect(char).toEqual(original);
  });
});
