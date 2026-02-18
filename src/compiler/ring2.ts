import type {
  ChapterArc,
  Bible,
  NarrativeIR,
  CompilationConfig,
  RingSection,
} from "../types/index.js";
import { countTokens } from "../tokens/index.js";
import { assembleSections } from "./helpers.js";

export interface Ring2Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
}

export function buildRing2(
  chapterArc: ChapterArc,
  bible: Bible,
  previousSceneIRs: NarrativeIR[],
  config: CompilationConfig,
): Ring2Result {
  const sections: RingSection[] = [];

  // --- Chapter Brief (immune) ---
  const briefParts: string[] = [
    `Chapter ${chapterArc.chapterNumber}: ${chapterArc.workingTitle}`,
  ];
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
  const activeSetups = bible.narrativeRules.setups.filter(
    (s) => s.status === "planned" || s.status === "planted",
  );
  if (activeSetups.length > 0) {
    sections.push({
      name: "ACTIVE_SETUPS",
      text:
        `ACTIVE SETUPS:\n` +
        activeSetups.map((s) => `- ${s.description} [${s.status}]`).join("\n"),
      priority: 4,
      immune: false,
    });
  }

  // Phase 1: previousSceneIRs is always [] — IR extraction is deferred
  // In future phases, we'd add character epistemic states and cross-scene continuity here

  const text = assembleSections(sections);
  const tokenCount = countTokens(text);

  return { text, sections, tokenCount };
}
