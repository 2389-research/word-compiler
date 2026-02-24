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

export function formatAntiAblation(plan: ScenePlan): string {
  const lines: string[] = [`=== ANTI-ABLATION ===`];

  if (plan.sceneSpecificProhibitions.length > 0) {
    lines.push(`Scene-specific bans:`);
    for (const p of plan.sceneSpecificProhibitions) {
      lines.push(`- ${p}`);
    }
  }

  lines.push(`\nGENERAL:`);
  lines.push(`- Do not summarize what just happened.`);
  lines.push(`- Do not have characters explain their own motivations.`);
  lines.push(`- Do not resolve tension unless the scene contract calls for it.`);
  lines.push(`- Subtext must remain sub. If a character states the theme, you have failed.`);
  lines.push(`- Prefer specific, embodied detail over abstract description.`);
  lines.push(`- Vary sentence length. Monotony is failure.`);

  return lines.join("\n");
}

export function assembleSections(sections: RingSection[]): string {
  return sections.map((s) => s.text).join("\n\n");
}
