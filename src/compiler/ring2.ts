import { countTokens } from "../tokens/index.js";
import type { Bible, ChapterArc, CharacterDelta, CompilationConfig, NarrativeIR, RingSection } from "../types/index.js";
import { assembleSections } from "./helpers.js";

export interface Ring2Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
}

// ─── IR-derived character state ──────────────────────────

function buildCharacterStateFromDeltas(deltas: CharacterDelta[]): string {
  const parts: string[] = [];
  if (deltas.some((d) => d.learned)) {
    parts.push(
      `Knows: ${deltas
        .filter((d) => d.learned)
        .map((d) => d.learned)
        .join("; ")}`,
    );
  }
  if (deltas.some((d) => d.suspicionGained)) {
    parts.push(
      `Suspects: ${deltas
        .filter((d) => d.suspicionGained)
        .map((d) => d.suspicionGained)
        .join("; ")}`,
    );
  }
  if (deltas.some((d) => d.emotionalShift)) {
    const last = [...deltas].reverse().find((d) => d.emotionalShift);
    if (last) parts.push(`Emotional state: ${last.emotionalShift}`);
  }
  if (deltas.some((d) => d.relationshipChange)) {
    parts.push(
      `Relationships: ${deltas
        .filter((d) => d.relationshipChange)
        .map((d) => d.relationshipChange)
        .join("; ")}`,
    );
  }
  return parts.join("\n");
}

export function buildRing2(
  chapterArc: ChapterArc,
  bible: Bible,
  previousSceneIRs: NarrativeIR[],
  _config: CompilationConfig,
): Ring2Result {
  const sections: RingSection[] = [];

  // --- Chapter Brief (immune) ---
  const briefParts: string[] = [`Chapter ${chapterArc.chapterNumber}: ${chapterArc.workingTitle}`];
  if (chapterArc.narrativeFunction) {
    briefParts.push(`Function: ${chapterArc.narrativeFunction}`);
  }
  if (chapterArc.dominantRegister) {
    briefParts.push(`Register: ${chapterArc.dominantRegister}`);
  }
  if (chapterArc.pacingTarget) {
    briefParts.push(`Pacing: ${chapterArc.pacingTarget}`);
  }
  if (chapterArc.endingPosture) {
    briefParts.push(`Ending: ${chapterArc.endingPosture}`);
  }
  sections.push({
    name: "CHAPTER_BRIEF",
    text: `=== CHAPTER CONTEXT ===\n${briefParts.join("\n")}`,
    priority: 0,
    immune: true,
  });

  // --- Reader State at Entry (compressible) ---
  const entering = chapterArc.readerStateEntering;
  if (entering) {
    const parts: string[] = [];
    if (entering.knows.length > 0) parts.push(`Knows: ${entering.knows.join("; ")}`);
    if (entering.suspects.length > 0) parts.push(`Suspects: ${entering.suspects.join("; ")}`);
    if (entering.wrongAbout.length > 0) parts.push(`Wrong about: ${entering.wrongAbout.join("; ")}`);
    if (entering.activeTensions.length > 0) parts.push(`Tensions: ${entering.activeTensions.join("; ")}`);
    if (parts.length > 0) {
      sections.push({
        name: "READER_STATE_ENTRY",
        text: `READER STATE AT CHAPTER START:\n${parts.join("\n")}`,
        priority: 3,
        immune: false,
      });
    }
  }

  // --- Active Setups (compressible) ---
  const activeSetups = bible.narrativeRules.setups.filter((s) => s.status === "planned" || s.status === "planted");
  if (activeSetups.length > 0) {
    sections.push({
      name: "ACTIVE_SETUPS",
      text: `ACTIVE SETUPS:\n${activeSetups.map((s) => `- ${s.description} [${s.status}]`).join("\n")}`,
      priority: 4,
      immune: false,
    });
  }

  // --- IR-Derived Character States (compressible, one section per active character) ---
  // Only added when verified IRs are available — skip for scene 1
  const verifiedIRs = previousSceneIRs.filter((ir) => ir.verified);
  if (verifiedIRs.length > 0) {
    // Gather all character ids that appear in any delta
    const characterIds = new Set<string>();
    for (const ir of verifiedIRs) {
      for (const delta of ir.characterDeltas) {
        if (delta.characterId) characterIds.add(delta.characterId);
      }
    }

    for (const charId of characterIds) {
      const char = bible.characters.find((c) => c.id === charId);
      const characterName = char?.name ?? charId;

      // Cumulative deltas for this character across all prior scenes
      const cumulativeDeltas = verifiedIRs.flatMap((ir) => ir.characterDeltas.filter((d) => d.characterId === charId));

      const stateText = buildCharacterStateFromDeltas(cumulativeDeltas);
      if (!stateText) continue;

      // Also include last known position if any IR has it
      const lastPositionIR = [...verifiedIRs]
        .reverse()
        .find((ir) => ir.characterPositions[characterName] || ir.characterPositions[charId]);
      const position = lastPositionIR?.characterPositions[characterName] ?? lastPositionIR?.characterPositions[charId];

      const fullText = position ? `${stateText}\nLast position: ${position}` : stateText;

      sections.push({
        name: `CHAR_STATE_${charId.toUpperCase().replace(/-/g, "_")}`,
        text: `CHARACTER STATE — ${characterName.toUpperCase()} (entering this scene):\n${fullText}`,
        priority: 2,
        immune: false,
      });
    }

    // --- Unresolved Tensions from last scene (compressible) ---
    const lastIR = verifiedIRs[verifiedIRs.length - 1]!;
    if (lastIR.unresolvedTensions.length > 0) {
      sections.push({
        name: "UNRESOLVED_TENSIONS",
        text: `UNRESOLVED TENSIONS ENTERING THIS SCENE:\n${lastIR.unresolvedTensions.map((t) => `- ${t}`).join("\n")}`,
        priority: 3,
        immune: false,
      });
    }
  }

  const text = assembleSections(sections);
  const tokenCount = countTokens(text);

  return { text, sections, tokenCount };
}
