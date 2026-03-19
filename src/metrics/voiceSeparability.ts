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

// ─── Proximity-based dialogue attribution ───────
//
// Instead of matching specific dialogue verbs ("said", "asked", etc.),
// we find all quoted text, then search a small context window around each
// quote for any known character name from the bible. This handles any
// attribution style: "Dialogue," Marcus said. / Marcus turned. "Dialogue." /
// "Dialogue." Marcus slammed the door. — no verb enumeration needed.

const QUOTE_RE = /[""\u201C\u201D]([^""\u201C\u201D]+)[""\u201C\u201D]/g;
const CONTEXT_WINDOW = 120; // chars before/after the quote to search for a name
const MIN_NAME_FRAGMENT_LENGTH = 3; // skip initials like "J." or "Al"

function buildCharacterIndex(bible: Bible) {
  const fragmentToChar = new Map<string, (typeof bible.characters)[number]>();
  const fragments: string[] = [];

  for (const char of bible.characters) {
    for (const part of char.name.split(/\s+/)) {
      if (part.length < MIN_NAME_FRAGMENT_LENGTH) continue;
      const lower = part.toLowerCase();
      if (!fragmentToChar.has(lower)) {
        fragmentToChar.set(lower, char);
        fragments.push(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      }
    }
  }

  if (fragments.length === 0) return { regex: null, fragmentToChar };
  // Sort longest-first so "Captain" matches before "Cap" if both existed
  fragments.sort((a, b) => b.length - a.length);
  return { regex: new RegExp(`\\b(${fragments.join("|")})\\b`, "gi"), fragmentToChar };
}

interface NameHit {
  char: Bible["characters"][number];
  distance: number;
}

function findNearestInWindow(
  text: string,
  searchRegex: RegExp,
  fragmentToChar: Map<string, Bible["characters"][number]>,
  measureFromEnd: boolean,
): NameHit | null {
  let best: NameHit | null = null;
  for (const match of text.matchAll(searchRegex)) {
    const char = fragmentToChar.get(match[1]!.toLowerCase());
    if (!char) continue;
    // After-window: distance = match position (first is closest to quote)
    // Before-window: distance = gap from match end to window end (last is closest)
    const distance = measureFromEnd ? text.length - (match.index! + match[0]!.length) : match.index!;
    if (!best || distance < best.distance) best = { char, distance };
  }
  return best;
}

export function extractDialogueByCharacter(prose: string, bible: Bible): DialogueBlock[] {
  const { regex: searchRegex, fragmentToChar } = buildCharacterIndex(bible);
  if (!searchRegex) return [];

  const blocks: DialogueBlock[] = [];

  for (const match of prose.matchAll(QUOTE_RE)) {
    const dialogueText = match[1]!.trim();
    if (!dialogueText || dialogueText.length < 2) continue;

    const quoteStart = match.index!;
    const quoteEnd = quoteStart + match[0]!.length;

    const afterText = prose.slice(quoteEnd, quoteEnd + CONTEXT_WINDOW);
    const beforeText = prose.slice(Math.max(0, quoteStart - CONTEXT_WINDOW), quoteStart);

    // Search both windows and pick the name closest to the quote boundary
    const afterHit = findNearestInWindow(afterText, searchRegex, fragmentToChar, false);
    const beforeHit = findNearestInWindow(beforeText, searchRegex, fragmentToChar, true);

    let char: Bible["characters"][number] | null = null;
    if (afterHit && beforeHit) {
      char = afterHit.distance <= beforeHit.distance ? afterHit.char : beforeHit.char;
    } else {
      char = (afterHit ?? beforeHit)?.char ?? null;
    }

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
  sentenceLengthStdDev: number;
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
      sentenceLengthStdDev: variance,
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
