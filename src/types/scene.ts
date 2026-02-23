import { generateId } from "./utils.js";

// ─── Reader State ───────────────────────────────────────

export interface ReaderState {
  knows: string[];
  suspects: string[];
  wrongAbout: string[];
  activeTensions: string[];
}

// ─── Scene Plan ─────────────────────────────────────────

export interface ScenePlan {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  povCharacterId: string;
  povDistance: "intimate" | "close" | "moderate" | "distant";
  narrativeGoal: string;
  emotionalBeat: string;
  readerEffect: string;
  readerStateEntering: ReaderState | null;
  readerStateExiting: ReaderState | null;
  characterKnowledgeChanges: Record<string, string>;
  subtext: {
    surfaceConversation: string;
    actualConversation: string;
    enforcementRule: string;
  } | null;
  dialogueConstraints: Record<string, string[]>;
  pacing: string | null;
  density: "sparse" | "moderate" | "dense";
  sensoryNotes: string | null;
  sceneSpecificProhibitions: string[];
  anchorLines: AnchorLine[];
  estimatedWordCount: [number, number];
  chunkCount: number;
  chunkDescriptions: string[];
  failureModeToAvoid: string;
  locationId: string | null;
}

export interface AnchorLine {
  text: string;
  placement: string;
  verbatim: boolean;
}

// ─── Chunk ──────────────────────────────────────────────

export interface Chunk {
  id: string;
  sceneId: string;
  sequenceNumber: number;
  generatedText: string;
  payloadHash: string;
  model: string;
  temperature: number;
  topP: number;
  generatedAt: string;
  status: "pending" | "accepted" | "edited" | "rejected";
  editedText: string | null;
  humanNotes: string | null;
}

// ─── Scene Status ───────────────────────────────────────

export type SceneStatus = "planned" | "drafting" | "complete";

// ─── Factory Functions ──────────────────────────────────

export function createEmptyScenePlan(projectId: string): ScenePlan {
  return {
    id: generateId(),
    projectId,
    chapterId: null,
    title: "",
    povCharacterId: "",
    povDistance: "close",
    narrativeGoal: "",
    emotionalBeat: "",
    readerEffect: "",
    readerStateEntering: null,
    readerStateExiting: null,
    characterKnowledgeChanges: {},
    subtext: null,
    dialogueConstraints: {},
    pacing: null,
    density: "moderate",
    sensoryNotes: null,
    sceneSpecificProhibitions: [],
    anchorLines: [],
    estimatedWordCount: [800, 1200],
    chunkCount: 3,
    chunkDescriptions: [],
    failureModeToAvoid: "",
    locationId: null,
  };
}

export function getCanonicalText(chunk: Chunk): string {
  return chunk.editedText ?? chunk.generatedText;
}
