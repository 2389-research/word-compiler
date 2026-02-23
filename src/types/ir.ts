// ─── Narrative IR ───────────────────────────────────────

export interface NarrativeIR {
  sceneId: string;
  verified: boolean;
  events: string[];
  factsIntroduced: string[];
  factsRevealedToReader: string[];
  factsWithheld: string[];
  characterDeltas: CharacterDelta[];
  setupsPlanted: string[];
  payoffsExecuted: string[];
  characterPositions: Record<string, string>;
  unresolvedTensions: string[];
}

export interface CharacterDelta {
  characterId: string;
  learned: string | null;
  suspicionGained: string | null;
  emotionalShift: string | null;
  relationshipChange: string | null;
}

// ─── Factory Functions ──────────────────────────────────

export function createEmptyNarrativeIR(sceneId: string): NarrativeIR {
  return {
    sceneId,
    verified: false,
    events: [],
    factsIntroduced: [],
    factsRevealedToReader: [],
    factsWithheld: [],
    characterDeltas: [],
    setupsPlanted: [],
    payoffsExecuted: [],
    characterPositions: {},
    unresolvedTensions: [],
  };
}
