import { splitSentences } from "../auditor/index.js";
import { countWords } from "../tokens/index.js";
import type { Bible, VoiceSeparabilityReport } from "../types/index.js";

// ─── Voice Separability ──────────────────────────────────
//
// Parses dialogue attribution by character, measures per-character
// sentence length distributions and type-token ratio.
// Flags if inter-character variance is low (voices are indistinguishable).

interface DialogueBlock {
  characterId: string;
  characterName: string;
  text: string;
}

// Match patterns like:
//   "Dialogue here," Alice said.
//   "Text." Bob turned away.
//   Alice said, "Dialogue."
const ATTRIBUTION_AFTER =
  /[""]([^""]+)[""]\s*[,.]?\s*([A-Z][a-z]+)\s+(?:said|asked|replied|whispered|shouted|murmured|called|answered|responded)/g;
const ATTRIBUTION_BEFORE =
  /([A-Z][a-z]+)\s+(?:said|asked|replied|whispered|shouted|murmured|called|answered|responded)[,\s]+"([^""]+)[""]?/g;

function extractDialogueByCharacter(prose: string, bible: Bible): DialogueBlock[] {
  const blocks: DialogueBlock[] = [];

  const findChar = (name: string) => bible.characters.find((c) => c.name.toLowerCase() === name.toLowerCase());

  // Pattern 1: "dialogue," Character verb
  for (const match of prose.matchAll(ATTRIBUTION_AFTER)) {
    const dialogueText = match[1]!;
    const charName = match[2]!;
    const char = findChar(charName);
    if (char) {
      blocks.push({ characterId: char.id, characterName: char.name, text: dialogueText });
    }
  }

  // Pattern 2: Character verb, "dialogue"
  for (const match of prose.matchAll(ATTRIBUTION_BEFORE)) {
    const charName = match[1]!;
    const dialogueText = match[2]!;
    const char = findChar(charName);
    if (char) {
      blocks.push({ characterId: char.id, characterName: char.name, text: dialogueText });
    }
  }

  return blocks;
}

function computeDialogueStats(blocks: DialogueBlock[]): Array<{
  characterId: string;
  characterName: string;
  dialogueCount: number;
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  typeTokenRatio: number;
}> {
  // Group by character
  const byChar = new Map<string, { id: string; name: string; texts: string[] }>();
  for (const block of blocks) {
    if (!byChar.has(block.characterId)) {
      byChar.set(block.characterId, { id: block.characterId, name: block.characterName, texts: [] });
    }
    byChar.get(block.characterId)!.texts.push(block.text);
  }

  const stats = [];
  for (const { id, name, texts } of byChar.values()) {
    const combined = texts.join(" ");
    const sentences = splitSentences(combined);
    const allWords = combined.toLowerCase().match(/\b\w+\b/g) ?? [];
    const uniqueWords = new Set(allWords);

    const sentenceLengths = sentences.map((s) => countWords(s));
    const mean = sentenceLengths.length > 0 ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length : 0;
    const variance =
      sentenceLengths.length > 0
        ? Math.sqrt(sentenceLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / sentenceLengths.length)
        : 0;

    stats.push({
      characterId: id,
      characterName: name,
      dialogueCount: texts.length,
      avgSentenceLength: mean,
      sentenceLengthVariance: variance,
      typeTokenRatio: allWords.length > 0 ? uniqueWords.size / allWords.length : 0,
    });
  }

  return stats;
}

export function measureVoiceSeparability(
  sceneTexts: Array<{ sceneId: string; prose: string }>,
  bible: Bible,
): VoiceSeparabilityReport {
  const allProse = sceneTexts.map((s) => s.prose).join("\n\n");
  const dialogueBlocks = extractDialogueByCharacter(allProse, bible);
  const characterStats = computeDialogueStats(dialogueBlocks);

  if (characterStats.length < 2) {
    return {
      characterStats,
      interCharacterVariance: 0,
      separable: true, // Can't measure with <2 speakers
      detail:
        characterStats.length === 0
          ? "No attributed dialogue found — cannot measure voice separability."
          : "Only one character has attributed dialogue — cannot measure separability.",
    };
  }

  // Inter-character variance: std dev of avgSentenceLength across characters
  const avgLengths = characterStats.map((c) => c.avgSentenceLength);
  const mean = avgLengths.reduce((a, b) => a + b, 0) / avgLengths.length;
  const interCharacterVariance = Math.sqrt(avgLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / avgLengths.length);

  // Threshold: voices are separable if stddev of avg sentence length > 1.5 words
  const SEPARABILITY_THRESHOLD = 1.5;
  const separable = interCharacterVariance >= SEPARABILITY_THRESHOLD;

  return {
    characterStats,
    interCharacterVariance,
    separable,
    detail: separable
      ? `Voices are distinguishable (inter-character variance: ${interCharacterVariance.toFixed(2)} words).`
      : `Voices may be indistinguishable (inter-character variance: ${interCharacterVariance.toFixed(2)} words, threshold: ${SEPARABILITY_THRESHOLD}). Consider differentiating dialogue patterns.`,
  };
}
