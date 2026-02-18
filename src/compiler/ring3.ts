import type {
  ScenePlan,
  Bible,
  Chunk,
  CompilationConfig,
  Ring3Result,
  RingSection,
} from "../types/index.js";
import { getCanonicalText } from "../types/index.js";
import { countTokens, lastNTokens } from "../tokens/index.js";
import {
  formatSceneContract,
  formatCharacterVoice,
  formatSensoryPalette,
  formatAntiAblation,
  assembleSections,
} from "./helpers.js";

export function buildRing3(
  plan: ScenePlan,
  bible: Bible,
  previousChunks: Chunk[],
  chunkNumber: number,
  config: CompilationConfig,
): Ring3Result {
  const sections: RingSection[] = [];

  // --- Scene Contract (immune) ---
  sections.push({
    name: "SCENE_CONTRACT",
    text: formatSceneContract(plan),
    priority: 0,
    immune: true,
  });

  // --- Voice Fingerprints for speaking characters (immune) ---
  const speakingCharIds = Object.keys(plan.dialogueConstraints);
  // Always include POV character
  if (!speakingCharIds.includes(plan.povCharacterId)) {
    speakingCharIds.unshift(plan.povCharacterId);
  }

  for (const charId of speakingCharIds) {
    const char = bible.characters.find((c) => c.id === charId);
    if (!char) continue; // Silently skip — linter catches missing chars

    const constraints = plan.dialogueConstraints[charId] ?? [];
    sections.push({
      name: `VOICE_${char.name.toUpperCase()}`,
      text: formatCharacterVoice(char, constraints),
      priority: 0,
      immune: true,
    });
  }

  // --- Sensory Palette (compressible) ---
  if (plan.locationId) {
    const location = bible.locations.find((l) => l.id === plan.locationId);
    if (location) {
      sections.push({
        name: "SENSORY_PALETTE",
        text: formatSensoryPalette(location),
        priority: 4,
        immune: false,
      });
    }
  }

  // --- Anchor Lines (immune) ---
  if (plan.anchorLines.length > 0) {
    const anchorText =
      `=== ANCHOR LINES (human-authored) ===\n` +
      plan.anchorLines
        .map(
          (a) =>
            `"${a.text}"\n` +
            `Placement: ${a.placement}. ${a.verbatim ? "USE VERBATIM." : "Match energy; exact wording optional."}`,
        )
        .join("\n\n");

    sections.push({
      name: "ANCHOR_LINES",
      text: anchorText,
      priority: 0,
      immune: true,
    });
  }

  // --- Continuity Bridge (compressible) ---
  if (previousChunks.length > 0) {
    const lastChunk = previousChunks[previousChunks.length - 1]!;
    const canonText = getCanonicalText(lastChunk);

    const verbatim = lastNTokens(canonText, config.bridgeVerbatimTokens);
    sections.push({
      name: "CONTINUITY_BRIDGE",
      text: `=== PRECEDING TEXT (match rhythm and continuity) ===\n${verbatim}`,
      priority: 3,
      immune: false,
    });
  }

  // --- Anti-Ablation (immune) ---
  sections.push({
    name: "ANTI_ABLATION",
    text: formatAntiAblation(plan),
    priority: 0,
    immune: true,
  });

  // --- Micro-Directive from previous chunk human notes ---
  if (previousChunks.length > 0) {
    const lastChunk = previousChunks[previousChunks.length - 1]!;
    if (lastChunk.humanNotes) {
      sections.push({
        name: "MICRO_DIRECTIVE",
        text: `=== DIRECTION FOR THIS SECTION ===\n${lastChunk.humanNotes}`,
        priority: 0,
        immune: true,
      });
    }
  }

  const text = assembleSections(sections);

  return {
    text,
    sections,
    tokenCount: countTokens(text),
  };
}
