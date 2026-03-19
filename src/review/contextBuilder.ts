import type { Bible } from "../types/bible.js";
import type { ScenePlan } from "../types/scene.js";
import type { ReviewContext } from "./types.js";

export function buildReviewContext(bible: Bible, scenePlan: ScenePlan, editingInstructions?: string): ReviewContext {
  const presentIds = new Set(scenePlan.presentCharacterIds ?? []);
  const povId = scenePlan.povCharacterId || null;

  // Include POV character even if not explicitly in presentCharacterIds
  if (povId) presentIds.add(povId);

  const activeVoices = bible.characters
    .filter((c) => presentIds.has(c.id))
    .map((c) => ({
      name: c.name,
      fingerprint: formatFingerprint(c.voice),
    }));

  const pov = bible.narrativeRules.pov;
  const povRules =
    povId && pov
      ? {
          distance: scenePlan.povDistance ?? pov.distance,
          interiority: pov.interiority,
          reliability: pov.reliability,
        }
      : null;

  return {
    styleRules: {
      killList: bible.styleGuide.killList,
      metaphoricRegister: bible.styleGuide.metaphoricRegister,
      vocabularyPreferences: bible.styleGuide.vocabularyPreferences,
      sentenceArchitecture: bible.styleGuide.sentenceArchitecture,
      paragraphPolicy: bible.styleGuide.paragraphPolicy,
      structuralBans: bible.styleGuide.structuralBans,
    },
    activeVoices,
    povRules,
    subtextPolicy: bible.narrativeRules.subtextPolicy ?? "",
    editingInstructions: editingInstructions ?? "",
  };
}

function formatFingerprint(voice: Bible["characters"][number]["voice"]): string {
  const parts: string[] = [];
  if (voice.vocabularyNotes) parts.push(`vocab: ${voice.vocabularyNotes}`);
  if (voice.verbalTics.length > 0) parts.push(`tics: ${voice.verbalTics.join(", ")}`);
  if (voice.metaphoricRegister) parts.push(`register: ${voice.metaphoricRegister}`);
  if (voice.prohibitedLanguage.length > 0) parts.push(`banned: ${voice.prohibitedLanguage.join(", ")}`);
  return parts.join("; ") || "no distinct markers";
}
