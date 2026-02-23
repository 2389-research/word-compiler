import { generateId } from "./utils.js";

// ─── Bible ──────────────────────────────────────────────

export interface Bible {
  projectId: string;
  version: number;
  characters: CharacterDossier[];
  styleGuide: StyleGuide;
  narrativeRules: NarrativeRules;
  locations: Location[];
  createdAt: string;
  sourcePrompt: string | null;
}

export interface CharacterDossier {
  id: string;
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  physicalDescription: string | null;
  backstory: string | null;
  selfNarrative: string | null;
  contradictions: string[] | null;
  voice: VoiceFingerprint;
  behavior: CharacterBehavior | null;
}

export interface VoiceFingerprint {
  sentenceLengthRange: [number, number] | null;
  vocabularyNotes: string | null;
  verbalTics: string[];
  metaphoricRegister: string | null;
  prohibitedLanguage: string[];
  dialogueSamples: string[];
}

export interface CharacterBehavior {
  stressResponse: string | null;
  socialPosture: string | null;
  noticesFirst: string | null;
  lyingStyle: string | null;
  emotionPhysicality: string | null;
}

// ─── Style Guide ────────────────────────────────────────

export interface StyleGuide {
  metaphoricRegister: {
    approvedDomains: string[];
    prohibitedDomains: string[];
  } | null;
  vocabularyPreferences: VocabPreference[];
  sentenceArchitecture: {
    targetVariance: string | null;
    fragmentPolicy: string | null;
    notes: string | null;
  } | null;
  paragraphPolicy: {
    maxSentences: number | null;
    singleSentenceFrequency: string | null;
    notes: string | null;
  } | null;
  killList: KillListEntry[];
  negativeExemplars: Exemplar[];
  positiveExemplars: Exemplar[];
  structuralBans: string[];
}

export interface VocabPreference {
  preferred: string;
  insteadOf: string;
  context?: string;
}

export interface KillListEntry {
  pattern: string;
  type: "exact" | "structural";
}

export interface Exemplar {
  text: string;
  annotation: string;
  source?: string;
}

// ─── Narrative Rules ────────────────────────────────────

export interface NarrativeRules {
  pov: {
    default: "first" | "close-third" | "distant-third" | "omniscient";
    distance: "intimate" | "close" | "moderate" | "distant";
    interiority: "stream" | "filtered" | "behavioral-only";
    reliability: "reliable" | "unreliable";
    notes?: string;
  };
  subtextPolicy: string | null;
  expositionPolicy: string | null;
  sceneEndingPolicy: string | null;
  setups: SetupEntry[];
}

export interface SetupEntry {
  id: string;
  description: string;
  plantedInScene: string | null;
  payoffInScene: string | null;
  status: "planned" | "planted" | "paid-off" | "dangling";
}

// ─── Location ───────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  description: string | null;
  sensoryPalette: {
    sounds: string[];
    smells: string[];
    textures: string[];
    lightQuality: string | null;
    atmosphere: string | null;
    prohibitedDefaults: string[];
  };
}

// ─── Factory Functions ──────────────────────────────────

export function createEmptyBible(projectId: string): Bible {
  return {
    projectId,
    version: 1,
    characters: [],
    styleGuide: {
      metaphoricRegister: null,
      vocabularyPreferences: [],
      sentenceArchitecture: null,
      paragraphPolicy: null,
      killList: [],
      negativeExemplars: [],
      positiveExemplars: [],
      structuralBans: [],
    },
    narrativeRules: {
      pov: {
        default: "close-third",
        distance: "close",
        interiority: "filtered",
        reliability: "reliable",
      },
      subtextPolicy: null,
      expositionPolicy: null,
      sceneEndingPolicy: null,
      setups: [],
    },
    locations: [],
    createdAt: new Date().toISOString(),
    sourcePrompt: null,
  };
}

export function createEmptyCharacterDossier(name: string): CharacterDossier {
  return {
    id: generateId(),
    name,
    role: "supporting",
    physicalDescription: null,
    backstory: null,
    selfNarrative: null,
    contradictions: null,
    voice: {
      sentenceLengthRange: null,
      vocabularyNotes: null,
      verbalTics: [],
      metaphoricRegister: null,
      prohibitedLanguage: [],
      dialogueSamples: [],
    },
    behavior: null,
  };
}
