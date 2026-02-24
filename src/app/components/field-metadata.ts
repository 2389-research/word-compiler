/**
 * Field priority classifications for progressive disclosure.
 *
 * - essential: Can't meaningfully generate prose without this (always visible)
 * - helpful:   Improves quality but not blocking (collapsed by default)
 * - advanced:  For refinement and power users (collapsed, nested deeper)
 */

export type FieldPriority = "essential" | "helpful" | "advanced";

export const BIBLE_FIELD_PRIORITIES = {
  // ─── Foundations ─────────────────────────────────
  povDefault: "essential",
  povDistance: "helpful",
  povInteriority: "helpful",
  povReliability: "helpful",

  // ─── Characters (per character) ──────────────────
  characterName: "essential",
  characterRole: "essential",
  physicalDescription: "helpful",
  backstory: "helpful",

  // Voice
  vocabularyNotes: "helpful",
  verbalTics: "advanced",
  metaphoricRegister: "advanced",
  prohibitedLanguage: "advanced",
  dialogueSamples: "helpful",
  sentenceLengthRange: "advanced",

  // Behavior
  stressResponse: "advanced",
  socialPosture: "advanced",
  noticesFirst: "advanced",
  lyingStyle: "advanced",
  emotionPhysicality: "helpful",

  // ─── Locations (per location) ────────────────────
  locationName: "essential",
  locationDescription: "essential",
  sounds: "helpful",
  smells: "helpful",
  textures: "helpful",
  lightQuality: "helpful",
  atmosphere: "helpful",
  prohibitedDefaults: "advanced",

  // ─── Style Guide ────────────────────────────────
  approvedMetaphoricDomains: "helpful",
  prohibitedMetaphoricDomains: "helpful",
  killList: "essential",
  vocabularyPreferences: "advanced",
  structuralBans: "advanced",
} satisfies Record<string, FieldPriority>;

export const SCENE_FIELD_PRIORITIES = {
  // ─── Core Identity ──────────────────────────────
  sceneTitle: "essential",
  povCharacterId: "essential",
  scenePovDistance: "helpful",
  narrativeGoal: "essential",
  emotionalBeat: "essential",
  readerEffect: "helpful",
  failureModeToAvoid: "helpful",

  // ─── Reader Knowledge ───────────────────────────
  readerStateKnows: "helpful",
  readerStateSuspects: "helpful",
  readerStateWrongAbout: "advanced",
  readerStateActiveTensions: "helpful",
  // Exiting mirrors entering priorities
  readerStateExitingKnows: "helpful",
  readerStateExitingSuspects: "helpful",
  readerStateExitingWrongAbout: "advanced",
  readerStateExitingActiveTensions: "helpful",

  // ─── Texture ────────────────────────────────────
  pacing: "helpful",
  density: "helpful",
  sensoryNotes: "helpful",
  sceneLocationId: "essential",
  sceneSpecificProhibitions: "helpful",

  // Subtext
  subtextSurface: "advanced",
  subtextActual: "advanced",
  subtextEnforcement: "advanced",

  // Anchor Lines
  anchorLines: "advanced",

  // ─── Structure ──────────────────────────────────
  estimatedWordCount: "essential",
  chunkCount: "essential",
  chunkDescriptions: "helpful",
} satisfies Record<string, FieldPriority>;

/** Section-level priorities for collapsible groups */
export const BIBLE_SECTION_PRIORITIES = {
  "foundations-essential": "essential",
  "foundations-helpful": "helpful",
  "character-essential": "essential",
  "character-voice": "helpful",
  "character-behavior": "advanced",
  "location-essential": "essential",
  "location-sensory": "helpful",
  "style-essential": "essential",
  "style-avoidList": "essential",
  "style-vocabPrefs": "advanced",
  "style-structuralBans": "advanced",
} satisfies Record<string, FieldPriority>;

export const SCENE_SECTION_PRIORITIES = {
  "core-essential": "essential",
  "core-helpful": "helpful",
  "reader-entering": "helpful",
  "reader-exiting": "helpful",
  "texture-essential": "helpful",
  "texture-subtext": "advanced",
  "texture-anchorLines": "advanced",
  "structure-essential": "essential",
} satisfies Record<string, FieldPriority>;
