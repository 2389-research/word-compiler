import type { AuditFlag, Bible, NarrativeIR } from "../types/index.js";
import { generateId } from "../types/index.js";

// ─── Epistemic Leak Detection ────────────────────────────
//
// Checks whether any character in the current scene references knowledge
// that has no documented source in prior IRs or the current scene's
// factsIntroduced / factsRevealedToReader.

function buildCharacterKnowledgeSet(characterId: string, priorIRs: NarrativeIR[]): Set<string> {
  const known = new Set<string>();
  for (const ir of priorIRs) {
    for (const delta of ir.characterDeltas) {
      if (delta.characterId !== characterId) continue;
      if (delta.learned) known.add(delta.learned.toLowerCase());
      if (delta.suspicionGained) known.add(delta.suspicionGained.toLowerCase());
    }
    // Facts introduced to the world (any character could potentially learn)
    for (const fact of ir.factsIntroduced) {
      known.add(fact.toLowerCase());
    }
  }
  return known;
}

export function checkEpistemicLeaks(sceneIR: NarrativeIR, allPriorIRs: NarrativeIR[], bible: Bible): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const verifiedPriorIRs = allPriorIRs.filter((ir) => ir.verified);

  // Facts available to all characters from this scene's events
  const currentSceneFacts = new Set<string>([
    ...sceneIR.factsIntroduced.map((f) => f.toLowerCase()),
    ...sceneIR.factsRevealedToReader.map((f) => f.toLowerCase()),
  ]);

  for (const delta of sceneIR.characterDeltas) {
    const { characterId, learned } = delta;
    if (!learned) continue;

    const char = bible.characters.find((c) => c.id === characterId);
    const charName = char?.name ?? characterId;

    const priorKnowledge = buildCharacterKnowledgeSet(characterId, verifiedPriorIRs);

    // Check if what the character "learned" could be sourced from prior knowledge
    // or from the current scene's facts
    const learnedLower = learned.toLowerCase();
    const sourced = priorKnowledge.has(learnedLower) || currentSceneFacts.has(learnedLower);

    // Substring matching: check if any prior fact or current fact is a substring
    const substringSourced =
      !sourced &&
      [...priorKnowledge, ...currentSceneFacts].some(
        (fact) => learnedLower.includes(fact) || fact.includes(learnedLower),
      );

    if (!sourced && !substringSourced) {
      flags.push({
        id: generateId(),
        sceneId: sceneIR.sceneId,
        severity: "warning",
        category: "epistemic_leak",
        message: `${charName} appears to know "${learned}" but no source was found in prior scene IRs or current scene facts. Possible epistemic leak.`,
        lineReference: null,
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
    }
  }

  return flags;
}
