import type { VoiceGuide } from "../profile/types.js";
import { countTokens, truncateToTokens } from "../tokens/index.js";
import type { Bible, CompilationConfig, Ring1Result, RingSection } from "../types/index.js";

function buildMetaphorSection(bible: Bible): RingSection | null {
  if (!bible.styleGuide.metaphoricRegister) return null;
  const mr = bible.styleGuide.metaphoricRegister;
  const parts: string[] = [];
  if (mr.approvedDomains.length > 0) {
    parts.push(`Draw from ${mr.approvedDomains.join(", ")}.`);
  }
  if (mr.prohibitedDomains.length > 0) {
    parts.push(`Never: ${mr.prohibitedDomains.join(", ")}.`);
  }
  if (parts.length === 0) return null;
  return {
    name: "METAPHORS",
    text: `METAPHORS: ${parts.join(" ")}`,
    priority: 5,
    immune: false,
  };
}

function buildVocabularySection(bible: Bible): RingSection | null {
  if (bible.styleGuide.vocabularyPreferences.length === 0) return null;
  const prefs = bible.styleGuide.vocabularyPreferences.map((v) => `"${v.preferred}" not "${v.insteadOf}"`).join(" | ");
  return {
    name: "VOCABULARY",
    text: `VOCABULARY: ${prefs}`,
    priority: 4,
    immune: false,
  };
}

function buildSentenceSection(bible: Bible): RingSection | null {
  if (!bible.styleGuide.sentenceArchitecture) return null;
  const sa = bible.styleGuide.sentenceArchitecture;
  const parts: string[] = [];
  if (sa.targetVariance) parts.push(sa.targetVariance);
  if (sa.fragmentPolicy) parts.push(`Fragments: ${sa.fragmentPolicy}`);
  if (sa.notes) parts.push(sa.notes);
  if (parts.length === 0) return null;
  return {
    name: "SENTENCES",
    text: `SENTENCES: ${parts.join(". ")}`,
    priority: 3,
    immune: false,
  };
}

function buildParagraphSection(bible: Bible): RingSection | null {
  if (!bible.styleGuide.paragraphPolicy) return null;
  const pp = bible.styleGuide.paragraphPolicy;
  const parts: string[] = [];
  if (pp.maxSentences) parts.push(`Max ${pp.maxSentences} sentences`);
  if (pp.singleSentenceFrequency) parts.push(`Singles: ${pp.singleSentenceFrequency}`);
  if (pp.notes) parts.push(pp.notes);
  if (parts.length === 0) return null;
  return {
    name: "PARAGRAPHS",
    text: `PARAGRAPHS: ${parts.join(". ")}`,
    priority: 3,
    immune: false,
  };
}

function buildKillListSection(bible: Bible): RingSection | null {
  const exactKills = bible.styleGuide.killList.filter((k) => k.type === "exact");
  if (exactKills.length === 0) return null;
  const kills = exactKills.map((k) => `"${k.pattern}"`).join(" | ");
  return {
    name: "NEVER_WRITE",
    text: `NEVER WRITE: ${kills}`,
    priority: 0,
    immune: true,
  };
}

function buildStructuralRulesSection(bible: Bible): RingSection | null {
  if (bible.styleGuide.structuralBans.length === 0) return null;
  return {
    name: "STRUCTURAL_RULES",
    text: `STRUCTURAL RULES:\n${bible.styleGuide.structuralBans.map((b) => `- ${b}`).join("\n")}`,
    priority: 0,
    immune: true,
  };
}

function buildNegativeExemplarsSection(bible: Bible, config: CompilationConfig): RingSection | null {
  const negExemplars = bible.styleGuide.negativeExemplars.slice(0, config.maxNegativeExemplars);
  if (negExemplars.length === 0) return null;
  return {
    name: "NEGATIVE_EXEMPLARS",
    text: `DO NOT SOUND LIKE THIS:\n${negExemplars.map((e) => `"${e.text}"`).join("\n")}`,
    priority: 6,
    immune: false,
  };
}

function buildPositiveExemplarsSection(bible: Bible, config: CompilationConfig): RingSection | null {
  const posExemplars = bible.styleGuide.positiveExemplars.slice(0, config.maxPositiveExemplars);
  if (posExemplars.length === 0) return null;
  return {
    name: "POSITIVE_EXEMPLARS",
    text: `THE VOICE SOUNDS LIKE THIS:\n${posExemplars.map((e) => `"${e.text}"`).join("\n")}`,
    priority: 6,
    immune: false,
  };
}

function buildPovSection(bible: Bible): RingSection | null {
  if (!bible.narrativeRules.pov) return null;
  const pov = bible.narrativeRules.pov;
  return {
    name: "POV",
    text:
      `POV: ${pov.default}, ${pov.distance} distance. ` +
      `Interiority: ${pov.interiority}. ` +
      `Narrator: ${pov.reliability}.` +
      (pov.notes ? ` ${pov.notes}` : ""),
    priority: 0,
    immune: true,
  };
}

const NON_INVENTION_GUARDRAIL = "Do not invent facts, credentials, or claims beyond what is provided in context";

function buildNarrativeRulesSection(bible: Bible): RingSection {
  const rules: string[] = [NON_INVENTION_GUARDRAIL];
  if (bible.narrativeRules.subtextPolicy) {
    rules.push(bible.narrativeRules.subtextPolicy);
  }
  if (bible.narrativeRules.expositionPolicy) {
    rules.push(bible.narrativeRules.expositionPolicy);
  }
  if (bible.narrativeRules.sceneEndingPolicy) {
    rules.push(bible.narrativeRules.sceneEndingPolicy);
  }
  return {
    name: "NARRATIVE_RULES",
    text: `NARRATIVE RULES: ${rules.join(". ")}`,
    priority: 0,
    immune: true,
  };
}

export function buildRing1(bible: Bible, config: CompilationConfig, voiceGuide?: VoiceGuide): Ring1Result {
  // Header (immune, always first)
  const header: RingSection = {
    name: "HEADER",
    text: "=== PROJECT VOICE ===",
    priority: 0,
    immune: true,
  };

  const candidateSections: (RingSection | null)[] = [
    header,
    buildMetaphorSection(bible),
    buildVocabularySection(bible),
    buildSentenceSection(bible),
    buildParagraphSection(bible),
    buildKillListSection(bible),
    buildStructuralRulesSection(bible),
    buildNegativeExemplarsSection(bible, config),
    buildPositiveExemplarsSection(bible, config),
    buildPovSection(bible),
    buildNarrativeRulesSection(bible),
  ];

  if (voiceGuide?.ring1Injection) {
    candidateSections.push({
      name: "AUTHOR_VOICE",
      text: `=== AUTHOR VOICE ===\n${voiceGuide.ring1Injection}`,
      priority: 1,
      immune: false,
    });
  }

  if (voiceGuide?.representativeExcerpts) {
    candidateSections.push({
      name: "REFERENCE_PROSE",
      text: `=== REFERENCE PROSE (match this voice) ===\n${voiceGuide.representativeExcerpts}`,
      priority: 2,
      immune: false,
    });
  }

  const sections = candidateSections.filter((s): s is RingSection => s !== null);

  // Assemble
  let text = sections.map((s) => s.text).join("\n\n");

  // Hard cap enforcement — bump cap by voice injection + reference prose tokens
  let voiceTokenBump = 0;
  if (voiceGuide?.ring1Injection) voiceTokenBump += countTokens(voiceGuide.ring1Injection) + 20;
  if (voiceGuide?.representativeExcerpts) voiceTokenBump += countTokens(voiceGuide.representativeExcerpts) + 20;
  const effectiveCap = config.ring1HardCap + voiceTokenBump;
  let wasTruncated = false;
  const tokens = countTokens(text);
  if (tokens > effectiveCap) {
    text = truncateToTokens(text, effectiveCap);
    wasTruncated = true;
  }

  return {
    text,
    sections,
    tokenCount: countTokens(text),
    wasTruncated,
  };
}
