import type { Bible, CompilationConfig, Ring1Result, RingSection } from "../types/index.js";
import { countTokens, truncateToTokens } from "../tokens/index.js";

export function buildRing1(bible: Bible, config: CompilationConfig): Ring1Result {
  const sections: RingSection[] = [];

  // Header (immune, always first)
  sections.push({
    name: "HEADER",
    text: "=== PROJECT VOICE ===",
    priority: 0,
    immune: true,
  });

  // --- Prose Genome ---
  if (bible.styleGuide.metaphoricRegister) {
    const mr = bible.styleGuide.metaphoricRegister;
    const parts: string[] = [];
    if (mr.approvedDomains.length > 0) {
      parts.push(`Draw from ${mr.approvedDomains.join(", ")}.`);
    }
    if (mr.prohibitedDomains.length > 0) {
      parts.push(`Never: ${mr.prohibitedDomains.join(", ")}.`);
    }
    if (parts.length > 0) {
      sections.push({
        name: "METAPHORS",
        text: `METAPHORS: ${parts.join(" ")}`,
        priority: 5,
        immune: false,
      });
    }
  }

  if (bible.styleGuide.vocabularyPreferences.length > 0) {
    const prefs = bible.styleGuide.vocabularyPreferences
      .map((v) => `"${v.preferred}" not "${v.insteadOf}"`)
      .join(" | ");
    sections.push({
      name: "VOCABULARY",
      text: `VOCABULARY: ${prefs}`,
      priority: 4,
      immune: false,
    });
  }

  if (bible.styleGuide.sentenceArchitecture) {
    const sa = bible.styleGuide.sentenceArchitecture;
    const parts: string[] = [];
    if (sa.targetVariance) parts.push(sa.targetVariance);
    if (sa.fragmentPolicy) parts.push(`Fragments: ${sa.fragmentPolicy}`);
    if (sa.notes) parts.push(sa.notes);
    if (parts.length > 0) {
      sections.push({
        name: "SENTENCES",
        text: `SENTENCES: ${parts.join(". ")}`,
        priority: 3,
        immune: false,
      });
    }
  }

  if (bible.styleGuide.paragraphPolicy) {
    const pp = bible.styleGuide.paragraphPolicy;
    const parts: string[] = [];
    if (pp.maxSentences) parts.push(`Max ${pp.maxSentences} sentences`);
    if (pp.singleSentenceFrequency) parts.push(`Singles: ${pp.singleSentenceFrequency}`);
    if (pp.notes) parts.push(pp.notes);
    if (parts.length > 0) {
      sections.push({
        name: "PARAGRAPHS",
        text: `PARAGRAPHS: ${parts.join(". ")}`,
        priority: 3,
        immune: false,
      });
    }
  }

  // --- Kill List (immune — never removed) ---
  const exactKills = bible.styleGuide.killList.filter((k) => k.type === "exact");
  if (exactKills.length > 0) {
    const kills = exactKills.map((k) => `"${k.pattern}"`).join(" | ");
    sections.push({
      name: "NEVER_WRITE",
      text: `NEVER WRITE: ${kills}`,
      priority: 0,
      immune: true,
    });
  }

  // --- Structural Bans (immune) ---
  if (bible.styleGuide.structuralBans.length > 0) {
    sections.push({
      name: "STRUCTURAL_RULES",
      text:
        `STRUCTURAL RULES:\n` +
        bible.styleGuide.structuralBans.map((b) => `- ${b}`).join("\n"),
      priority: 0,
      immune: true,
    });
  }

  // --- Negative Exemplars ---
  const negExemplars = bible.styleGuide.negativeExemplars.slice(
    0,
    config.maxNegativeExemplars,
  );
  if (negExemplars.length > 0) {
    sections.push({
      name: "NEGATIVE_EXEMPLARS",
      text:
        `DO NOT SOUND LIKE THIS:\n` +
        negExemplars.map((e) => `"${e.text}"`).join("\n"),
      priority: 6,
      immune: false,
    });
  }

  // --- Positive Exemplars ---
  const posExemplars = bible.styleGuide.positiveExemplars.slice(
    0,
    config.maxPositiveExemplars,
  );
  if (posExemplars.length > 0) {
    sections.push({
      name: "POSITIVE_EXEMPLARS",
      text:
        `THE VOICE SOUNDS LIKE THIS:\n` +
        posExemplars.map((e) => `"${e.text}"`).join("\n"),
      priority: 6,
      immune: false,
    });
  }

  // --- POV Contract (immune) ---
  if (bible.narrativeRules.pov) {
    const pov = bible.narrativeRules.pov;
    sections.push({
      name: "POV",
      text:
        `POV: ${pov.default}, ${pov.distance} distance. ` +
        `Interiority: ${pov.interiority}. ` +
        `Narrator: ${pov.reliability}.` +
        (pov.notes ? ` ${pov.notes}` : ""),
      priority: 0,
      immune: true,
    });
  }

  // --- Narrative Rules (immune) ---
  const rules: string[] = [];
  if (bible.narrativeRules.subtextPolicy) {
    rules.push(bible.narrativeRules.subtextPolicy);
  }
  if (bible.narrativeRules.expositionPolicy) {
    rules.push(bible.narrativeRules.expositionPolicy);
  }
  if (bible.narrativeRules.sceneEndingPolicy) {
    rules.push(bible.narrativeRules.sceneEndingPolicy);
  }
  if (rules.length > 0) {
    sections.push({
      name: "NARRATIVE_RULES",
      text: `NARRATIVE RULES: ${rules.join(". ")}`,
      priority: 0,
      immune: true,
    });
  }

  // Assemble
  let text = sections.map((s) => s.text).join("\n\n");

  // Hard cap enforcement
  let wasTruncated = false;
  const tokens = countTokens(text);
  if (tokens > config.ring1HardCap) {
    text = truncateToTokens(text, config.ring1HardCap);
    wasTruncated = true;
  }

  return {
    text,
    sections,
    tokenCount: countTokens(text),
    wasTruncated,
  };
}
