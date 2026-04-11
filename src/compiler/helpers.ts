import { truncateToTokens } from "../tokens/index.js";
import type { CharacterDossier, Location, RingSection, ScenePlan } from "../types/index.js";

export function formatSceneContract(plan: ScenePlan): string {
  const lines: string[] = [
    `=== SCENE: ${plan.title} ===`,
    `POV: ${plan.povCharacterId}, ${plan.povDistance}`,
    `Goal: ${plan.narrativeGoal}`,
    `Emotional beat: ${plan.emotionalBeat}`,
    `Reader should: ${plan.readerEffect}`,
  ];

  if (plan.subtext) {
    lines.push(
      `\nSUBTEXT CONTRACT:`,
      `Surface: ${plan.subtext.surfaceConversation}`,
      `Actual: ${plan.subtext.actualConversation}`,
      `RULE: ${plan.subtext.enforcementRule}`,
    );
  }

  if (plan.readerStateEntering) {
    const rs = plan.readerStateEntering;
    lines.push(
      `\nREADER ENTERING:`,
      `Knows: ${rs.knows.join("; ")}`,
      `Suspects: ${rs.suspects.join("; ")}`,
      `Wrong about: ${rs.wrongAbout.join("; ")}`,
    );
  }

  if (plan.readerStateExiting) {
    const rs = plan.readerStateExiting;
    lines.push(
      `\nREADER EXITING:`,
      `Should now know: ${rs.knows.join("; ")}`,
      `Should now suspect: ${rs.suspects.join("; ")}`,
    );
  }

  if (Object.keys(plan.characterKnowledgeChanges).length > 0) {
    lines.push(`\nCHARACTER KNOWLEDGE CHANGES:`);
    for (const [charId, change] of Object.entries(plan.characterKnowledgeChanges)) {
      lines.push(`${charId}: ${change}`);
    }
  }

  lines.push(`\nPacing: ${plan.pacing || "not specified"}`);
  lines.push(`Density: ${plan.density}`);
  lines.push(`Failure mode to avoid: ${plan.failureModeToAvoid}`);

  return lines.join("\n");
}

function formatVoiceDetails(voice: CharacterDossier["voice"]): string[] {
  const lines: string[] = [];
  if (voice.sentenceLengthRange) {
    lines.push(`Sentence length: ${voice.sentenceLengthRange[0]}-${voice.sentenceLengthRange[1]} words`);
  }
  if (voice.vocabularyNotes) {
    lines.push(`Vocabulary: ${voice.vocabularyNotes}`);
  }
  if (voice.verbalTics.length > 0) {
    lines.push(`Tics: ${voice.verbalTics.join("; ")}`);
  }
  if (voice.metaphoricRegister) {
    lines.push(`Metaphors from: ${voice.metaphoricRegister}`);
  }
  if (voice.prohibitedLanguage.length > 0) {
    lines.push(`Never says: ${voice.prohibitedLanguage.join(", ")}`);
  }
  if (voice.dialogueSamples.length > 0) {
    lines.push(`\nVoice samples:`);
    for (const sample of voice.dialogueSamples) {
      lines.push(`  "${sample}"`);
    }
  }
  return lines;
}

function formatBehavior(char: CharacterDossier): string[] {
  if (!char.behavior) return [];
  const b = char.behavior;
  const behaviorParts: string[] = [];
  if (b.emotionPhysicality) behaviorParts.push(`Body shows emotion: ${b.emotionPhysicality}`);
  if (b.stressResponse) behaviorParts.push(`Under stress: ${b.stressResponse}`);
  if (b.socialPosture) behaviorParts.push(`Social posture: ${b.socialPosture}`);
  if (b.noticesFirst) behaviorParts.push(`Notices first: ${b.noticesFirst}`);
  if (b.lyingStyle) behaviorParts.push(`Lying style: ${b.lyingStyle}`);
  if (behaviorParts.length === 0) return [];
  return [`\n${behaviorParts.join("\n")}`];
}

export function formatCharacterVoice(char: CharacterDossier, sceneConstraints: string[]): string {
  const lines: string[] = [`=== ${char.name.toUpperCase()} — VOICE ===`];

  lines.push(...formatVoiceDetails(char.voice));

  if (sceneConstraints.length > 0) {
    lines.push(`\nIn this scene:`);
    for (const constraint of sceneConstraints) {
      lines.push(`- ${constraint}`);
    }
  }

  lines.push(...formatBehavior(char));

  return lines.join("\n");
}

export function formatSensoryPalette(location: Location): string {
  const sp = location.sensoryPalette;
  const lines: string[] = [`=== LOCATION: ${location.name} ===`];

  if (location.description) {
    lines.push(truncateToTokens(location.description, 70));
  }

  if (sp.sounds.length > 0) lines.push(`Sounds: ${sp.sounds.join(", ")}`);
  if (sp.smells.length > 0) lines.push(`Smells: ${sp.smells.join(", ")}`);
  if (sp.textures.length > 0) lines.push(`Textures: ${sp.textures.join(", ")}`);
  if (sp.lightQuality) lines.push(`Light: ${sp.lightQuality}`);
  if (sp.atmosphere) lines.push(`Atmosphere: ${sp.atmosphere}`);
  if (sp.prohibitedDefaults.length > 0) {
    lines.push(`DO NOT default to: ${sp.prohibitedDefaults.join(", ")}`);
  }

  return lines.join("\n");
}

function formatBackstorySection(char: CharacterDossier): string[] {
  if (!char.backstory) return [];
  const lines = ["Backstory:"];
  for (const line of char.backstory.split("\n").filter(Boolean)) {
    lines.push(`- ${line.trim()}`);
  }
  lines.push("");
  return lines;
}

function formatContradictionsSection(contradictions: string[] | null): string[] {
  if (!Array.isArray(contradictions) || contradictions.length === 0) return [];
  const lines = ["Contradictions (show through action, never state directly):"];
  for (const c of contradictions) {
    lines.push(`- ${c}`);
  }
  lines.push("");
  return lines;
}

function formatBehaviorSection(behavior: CharacterDossier["behavior"]): string[] {
  if (!behavior) return [];
  const lines = ["Behavior:"];
  if (behavior.noticesFirst) lines.push(`- Notices first: ${behavior.noticesFirst}`);
  if (behavior.socialPosture) lines.push(`- Social posture: ${behavior.socialPosture}`);
  if (behavior.lyingStyle) lines.push(`- Lying style: ${behavior.lyingStyle}`);
  if (behavior.stressResponse) lines.push(`- Under stress: ${behavior.stressResponse}`);
  if (behavior.emotionPhysicality) lines.push(`- Body shows emotion: ${behavior.emotionPhysicality}`);
  lines.push("");
  return lines;
}

const POV_INTERIORITY_GUARDRAIL =
  "Show nuance through evidence, qualification, and tonal shifts — never contradict earlier claims without acknowledgment. Do not invent facts or credentials beyond what is provided in context.";

export function formatPovInteriority(char: CharacterDossier, povDistance: string): string {
  const lines: string[] = [`=== POV INTERIORITY: ${char.name.toUpperCase()} ===`];
  const includeDeep = povDistance === "intimate" || povDistance === "close";
  const includeContradictions = includeDeep || povDistance === "moderate";

  if (includeDeep) {
    lines.push(...formatBackstorySection(char));
    if (char.selfNarrative) {
      lines.push(`Self-narrative: ${char.selfNarrative}`, "");
    }
  }

  if (includeContradictions) {
    lines.push(...formatContradictionsSection(char.contradictions));
  }

  lines.push(...formatBehaviorSection(char.behavior));
  lines.push(POV_INTERIORITY_GUARDRAIL);

  return truncateToTokens(lines.join("\n"), 220);
}

export function formatForegroundCharacter(char: CharacterDossier): string {
  const lines: string[] = [`${char.name} (${char.role})`];
  if (char.physicalDescription) lines.push(`Physical: ${char.physicalDescription}`);
  return lines.join("\n");
}

export function formatBackgroundCharacter(char: CharacterDossier): string {
  const parts: string[] = [`- ${char.name} (${char.role})`];
  if (char.physicalDescription) {
    const cue = char.physicalDescription.split(/[.,;]/)[0]?.trim();
    if (cue) parts.push(`— ${cue}`);
  }
  return parts.join(" ");
}

export function formatAntiAblation(plan: ScenePlan): string {
  const lines: string[] = [`=== ANTI-ABLATION ===`];

  if (plan.sceneSpecificProhibitions.length > 0) {
    lines.push(`Scene-specific bans:`);
    for (const p of plan.sceneSpecificProhibitions) {
      lines.push(`- ${p}`);
    }
  }

  lines.push(`\nGENERAL:`);
  lines.push(`- Do not hedge unless warranted by genuine uncertainty.`);
  lines.push(`- Do not over-explain conclusions the evidence already supports.`);
  lines.push(
    `- Do not use throat-clearing transitions (However, Moreover, Furthermore, Additionally, It's worth noting).`,
  );
  lines.push(`- Do not restate what a previous section already established.`);
  lines.push(`- Vary paragraph length deliberately. Three consecutive similar-length paragraphs is failure.`);
  lines.push(`- Break the rule of three. Use two points or four, not three.`);
  lines.push(
    `- Avoid elegant variation — repeat a word naturally rather than cycling through synonyms (dog, canine, four-legged companion).`,
  );
  lines.push(`- Allow grammatical imperfection: fragments, sentences starting with 'And' or 'But', contractions.`);
  lines.push(`- Vary sentence length. Monotony is failure.`);

  return lines.join("\n");
}

export function formatSensoryGuardrail(): string {
  return [
    "=== DETAIL RULES ===",
    "Use concrete details as raw material — deploy them naturally in service of the argument.",
    "Every detail must have a job: ground the reader, support a claim, or make an abstraction tangible.",
    "AVOID: overwrought specificity, details that exist to demonstrate the writer's powers of observation rather than serve the piece.",
  ].join("\n");
}

export function assembleSections(sections: RingSection[]): string {
  return sections.map((s) => s.text).join("\n\n");
}
