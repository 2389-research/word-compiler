import { countTokens, lastNTokens } from "../tokens/index.js";
import type {
  Bible,
  Chunk,
  CompilationConfig,
  NarrativeIR,
  Ring3Result,
  RingSection,
  ScenePlan,
} from "../types/index.js";
import { getCanonicalText } from "../types/index.js";
import {
  assembleSections,
  formatAntiAblation,
  formatBackgroundCharacter,
  formatCharacterVoice,
  formatForegroundCharacter,
  formatPovInteriority,
  formatSceneContract,
  formatSensoryPalette,
} from "./helpers.js";

function buildVoiceFingerprints(speakingCharIds: string[], bible: Bible, plan: ScenePlan): RingSection[] {
  const sections: RingSection[] = [];
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
  return sections;
}

function buildContinuityBridge(previousChunks: Chunk[], config: CompilationConfig): RingSection | null {
  if (previousChunks.length === 0) return null;
  const lastChunk = previousChunks[previousChunks.length - 1]!;
  const canonText = getCanonicalText(lastChunk);
  const verbatim = lastNTokens(canonText, config.bridgeVerbatimTokens);
  return {
    name: "CONTINUITY_BRIDGE",
    text: `=== PRECEDING TEXT (continue directly from this point — do not repeat any of it) ===\n${verbatim}`,
    priority: 3,
    immune: false,
  };
}

function buildCrossSceneBridge(
  previousSceneLastChunk: Chunk,
  previousSceneIR: NarrativeIR | undefined,
  config: CompilationConfig,
): RingSection[] {
  const sections: RingSection[] = [];

  const canonText = getCanonicalText(previousSceneLastChunk);
  const verbatim = lastNTokens(canonText, config.bridgeVerbatimTokens);
  sections.push({
    name: "CONTINUITY_BRIDGE",
    text: `=== PRECEDING TEXT (previous scene — match rhythm and continuity) ===\n${verbatim}`,
    priority: 3,
    immune: false,
  });

  // Part B: IR state bullets (when verified IR is available for the previous scene)
  if (previousSceneIR?.verified && config.bridgeIncludeStateBullets) {
    const stateParts: string[] = [];
    if (previousSceneIR.unresolvedTensions.length > 0) {
      stateParts.push(`Unresolved tensions:\n${previousSceneIR.unresolvedTensions.map((t) => `  - ${t}`).join("\n")}`);
    }
    const positionEntries = Object.entries(previousSceneIR.characterPositions);
    if (positionEntries.length > 0) {
      stateParts.push(
        `Character positions:\n${positionEntries.map(([name, pos]) => `  - ${name}: ${pos}`).join("\n")}`,
      );
    }
    if (stateParts.length > 0) {
      sections.push({
        name: "CONTINUITY_BRIDGE_STATE",
        text: `=== STATE AT SCENE ENTRY ===\n${stateParts.join("\n")}`,
        priority: 3,
        immune: false,
      });
    }
  }

  return sections;
}

function buildSceneCast(presentIds: string[], speakingCharIds: string[], bible: Bible): RingSection[] {
  if (presentIds.length === 0) return [];

  const sections: RingSection[] = [
    {
      name: "SCENE_CAST_GUARDRAIL",
      text: "Only characters listed as present may appear. Do not introduce unnamed crowd, bystanders, or extras unless the scene plan explicitly calls for them.",
      priority: 0,
      immune: true,
    },
  ];

  const coveredIds = new Set(speakingCharIds);
  const nonSpeaking = presentIds
    .filter((id) => !coveredIds.has(id))
    .map((id) => bible.characters.find((c) => c.id === id))
    .filter((c) => c != null);

  if (nonSpeaking.length > 0) {
    const lines = nonSpeaking.map((c) =>
      nonSpeaking.length <= 3 ? formatForegroundCharacter(c) : formatBackgroundCharacter(c),
    );
    sections.push({
      name: "SCENE_CAST",
      text: `=== ALSO PRESENT ===\n${lines.join("\n")}`,
      priority: 2,
      immune: false,
    });
  }

  return sections;
}

function buildMicroDirective(previousChunks: Chunk[]): RingSection | null {
  if (previousChunks.length === 0) return null;
  const lastChunk = previousChunks[previousChunks.length - 1]!;
  if (!lastChunk.humanNotes) return null;
  return {
    name: "MICRO_DIRECTIVE",
    text: `=== DIRECTION FOR THIS SECTION ===\n${lastChunk.humanNotes}`,
    priority: 0,
    immune: true,
  };
}

export function buildRing3(
  plan: ScenePlan,
  bible: Bible,
  previousChunks: Chunk[],
  _chunkNumber: number,
  config: CompilationConfig,
  previousSceneLastChunk?: Chunk,
  previousSceneIR?: NarrativeIR,
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
  sections.push(...buildVoiceFingerprints(speakingCharIds, bible, plan));

  // --- POV Interiority (immune for intimate/close, compressible for moderate/distant) ---
  const povChar = bible.characters.find((c) => c.id === plan.povCharacterId);
  if (povChar) {
    const isDeepPov = plan.povDistance === "intimate" || plan.povDistance === "close";
    sections.push({
      name: "POV_INTERIORITY",
      text: formatPovInteriority(povChar, plan.povDistance),
      priority: isDeepPov ? 0 : 2,
      immune: isDeepPov,
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

  // --- Scene Cast (guardrail immune, character blurbs compressible) ---
  sections.push(...buildSceneCast(plan.presentCharacterIds ?? [], speakingCharIds, bible));

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
  const withinSceneBridge = buildContinuityBridge(previousChunks, config);
  if (withinSceneBridge) {
    sections.push(withinSceneBridge);
  } else if (previousSceneLastChunk) {
    sections.push(...buildCrossSceneBridge(previousSceneLastChunk, previousSceneIR, config));
  }

  // --- Anti-Ablation (immune) ---
  sections.push({
    name: "ANTI_ABLATION",
    text: formatAntiAblation(plan),
    priority: 0,
    immune: true,
  });

  // --- Micro-Directive from previous chunk human notes ---
  const directive = buildMicroDirective(previousChunks);
  if (directive) sections.push(directive);

  const text = assembleSections(sections);

  return {
    text,
    sections,
    tokenCount: countTokens(text),
  };
}
