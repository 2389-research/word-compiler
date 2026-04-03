# Narrative Orchestration System — Consolidated Build Plan

## The Definitive Reference (v1.0)

*Synthesizes: Original system design, kernel memo, software architecture, and build critique.*

> **Note:** This is a historical design document from the project's planning phase. The implementation has diverged in several areas — notably the app is browser-based (Vite + Express) rather than Tauri/Electron, uses TipTap and CodeMirror 6 rather than Monaco, and has 7 workflow stages (including Edit) rather than the 6 described here. See `docs/architecture/` for current architecture documentation.

---

## 0. Foundational Decisions

### 0.1 What We're Building

A local-first desktop application that compiles structured creative intent (characters, voice rules, scene contracts) into optimized LLM context payloads, enabling a human author to produce coherent long-form fiction through a gated, chunk-by-chunk workflow.

The app is a **context compiler with a UI on top.** The user never writes prompts. They fill in structured fields, write anchor lines, and edit generated prose. The app handles all context assembly, budget management, and constraint injection silently.

### 0.2 Three Structural Risks (Acknowledged, Addressed)

| Risk | Description | Resolution |
|------|-------------|------------|
| **Latency trap** | IR extraction after every chunk blocks the drafting flow | IR extraction is async/batched. User moves to next chunk while previous one "compiles." IR is a Phase 2 feature, not kernel. |
| **Empty bible friction** | Users won't fill 40 fields before writing line one | Bootstrap Mode: paste a synopsis, system hydrates a draft bible. User edits what matters, ignores the rest. |
| **Context window thrashing** | Ring 1 growth suffocates scene-level context | Hard token caps per ring. Ring 3 (scene) always gets ≥60%. Ring 1 has a ceiling, not a floor. Linter enforces. |

### 0.3 Technical Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js (TypeScript) | Type safety for the data model; ecosystem depth |
| Shell | Tauri (or Electron) | Local filesystem access, local DB, no sandbox constraints |
| Database | SQLite | Single file, relational, fast. Perfect for bible + chunks + logs |
| LLM interface | Direct API calls (Anthropic SDK) | Bare-metal control over prompt string construction. No magic chains. |
| LLM model | Claude Sonnet (primary), configurable | SOTA for nuance and instruction-following in creative writing |
| Prose editor | Monaco or ProseMirror | Rich diff support, inline annotations, chunk boundaries |

**Non-negotiable: write your own prompt assembly logic.** The context compiler is the core intellectual property. No LangChain abstractions, no template engines. Raw string construction with token counting at every step.

---

## 1. Data Model (All Phases)

### Design Principles

1. **Only track deltas, not cumulative state.** Epistemic tracking is O(N) per scene, not O(N²) across the project. The compiler reconstructs full state by replaying deltas when needed.
2. **Every generation is logged with its exact payload hash.** You'll need this for revision learning later, even if you don't build the learner yet.
3. **Bible fields are nullable.** Bootstrap mode hydrates what it can; the user fills in the rest over time. No field is required to start drafting.

### 1.1 Project

```typescript
interface Project {
  id: string;
  title: string;
  status: "bootstrap" | "bible" | "planning" | "drafting" | "revising";
  createdAt: string;
  updatedAt: string;
}
```

### 1.2 Bible

Version-controlled. Every save creates a new version. The compiler always reads latest.

```typescript
interface Bible {
  projectId: string;
  version: number;
  characters: CharacterDossier[];
  styleGuide: StyleGuide;
  narrativeRules: NarrativeRules;
  locations: Location[];
  createdAt: string;
}
```

#### 1.2.1 Character Dossier

```typescript
interface CharacterDossier {
  id: string;
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "minor";

  // Identity (free text, nullable — bootstrap fills what it can)
  physicalDescription: string | null;
  backstory: string | null;
  selfNarrative: string | null;          // what they believe about themselves
  contradictions: string[] | null;       // beliefs that aren't true

  // Voice Fingerprint (the load-bearing section)
  voice: VoiceFingerprint;

  // Behavioral Model (nullable — valuable but not blocking)
  behavior: CharacterBehavior | null;
}

interface VoiceFingerprint {
  sentenceLengthRange: [number, number] | null;   // e.g., [6, 14]
  vocabularyNotes: string | null;                  // free text description
  verbalTics: string[];                            // specific patterns
  metaphoricRegister: string | null;               // what domains they draw from
  prohibitedLanguage: string[];                    // words they'd never use
  dialogueSamples: string[];                       // human-authored anchor lines (CRITICAL)
}

interface CharacterBehavior {
  stressResponse: string | null;
  socialPosture: string | null;
  noticesFirst: string | null;
  lyingStyle: string | null;
  emotionPhysicality: string | null;    // how their body shows emotion
}
```

#### 1.2.2 Style Guide

```typescript
interface StyleGuide {
  // Prose Genome
  metaphoricRegister: {
    approvedDomains: string[];
    prohibitedDomains: string[];
  } | null;

  vocabularyPreferences: VocabPreference[];

  sentenceArchitecture: {
    targetVariance: string | null;       // description, not a number yet
    fragmentPolicy: string | null;
    notes: string | null;                // free text for anything else
  } | null;

  paragraphPolicy: {
    maxSentences: number | null;
    singleSentenceFrequency: string | null;
    notes: string | null;
  } | null;

  // Kill List (CRITICAL — works from day one)
  killList: KillListEntry[];

  // Exemplars
  negativeExemplars: Exemplar[];         // "never sound like this" (keep SHORT)
  positiveExemplars: Exemplar[];         // "target voice sounds like this"

  // Structural bans (preferred over phrase bans per kernel memo)
  structuralBans: string[];              // e.g., "Never end a paragraph on a stated emotion"
}

interface VocabPreference {
  preferred: string;
  insteadOf: string;
  context?: string;
}

interface KillListEntry {
  pattern: string;
  type: "exact" | "structural";
  // exact = literal string match ("a sense of")
  // structural = pattern description ("3+ consecutive same-structure sentences")
}

interface Exemplar {
  text: string;                          // keep under 80 tokens (priming risk above this)
  annotation: string;                    // what this demonstrates
  source?: string;
}
```

#### 1.2.3 Narrative Rules

```typescript
interface NarrativeRules {
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

  // Setup/Payoff Registry (Phase 1+)
  setups: SetupEntry[];
}

interface SetupEntry {
  id: string;
  description: string;
  plantedInScene: string | null;
  payoffInScene: string | null;
  status: "planned" | "planted" | "paid-off" | "dangling";
}
```

#### 1.2.4 Location

```typescript
interface Location {
  id: string;
  name: string;
  description: string | null;
  sensoryPalette: {
    sounds: string[];
    smells: string[];
    textures: string[];
    lightQuality: string | null;
    atmosphere: string | null;
    prohibitedDefaults: string[];        // "no 'dim lighting', no 'clink of glasses'"
  };
}
```

### 1.3 Chapter & Scene (Phase 1+)

```typescript
interface ChapterArc {
  id: string;
  projectId: string;
  chapterNumber: number;
  workingTitle: string;
  narrativeFunction: string;
  dominantRegister: string;
  pacingTarget: string;
  endingPosture: string;
  readerStateEntering: ReaderState;
  readerStateExiting: ReaderState;
}

interface ReaderState {
  knows: string[];
  suspects: string[];
  wrongAbout: string[];
  activeTensions: string[];
}
```

### 1.4 Scene Plan (The Contract)

This is the most important data structure in the system. It's what the compiler uses to build generation payloads.

```typescript
interface ScenePlan {
  id: string;                            // e.g., "ch04_sc02"
  projectId: string;
  chapterId: string | null;              // null in Phase 0 (standalone scene)

  title: string;

  // POV
  povCharacterId: string;
  povDistance: "intimate" | "close" | "moderate" | "distant";

  // Goals
  narrativeGoal: string;
  emotionalBeat: string;
  readerEffect: string;

  // Epistemic Contract
  readerStateEntering: ReaderState | null;
  readerStateExiting: ReaderState | null;
  characterKnowledgeChanges: Record<string, string>;

  // Subtext (CRITICAL for anti-ablation)
  subtext: {
    surfaceConversation: string;
    actualConversation: string;
    enforcementRule: string;             // what must NOT be stated
  } | null;

  // Character Constraints (per scene)
  dialogueConstraints: Record<string, string[]>;

  // Prose Directives
  pacing: string | null;
  density: "sparse" | "moderate" | "dense";
  sensoryNotes: string | null;
  sceneSpecificProhibitions: string[];

  // Human Anchors
  anchorLines: AnchorLine[];

  // Generation config
  estimatedWordCount: [number, number];
  chunkCount: number;
  chunkDescriptions: string[];           // e.g., ["arrival/setup", "conversation", "withdrawal"]
  failureModeToAvoid: string;

  // Location
  locationId: string | null;
}

interface AnchorLine {
  text: string;
  placement: string;                     // e.g., "final third, build toward it"
  verbatim: boolean;                     // must appear exactly as written?
}
```

### 1.5 Chunk

```typescript
interface Chunk {
  id: string;
  sceneId: string;
  sequenceNumber: number;

  // Generation
  generatedText: string;
  payloadHash: string;                   // hash of exact compiled context sent to LLM
  model: string;
  temperature: number;
  topP: number;
  generatedAt: string;

  // Human Review
  status: "pending" | "accepted" | "edited" | "rejected";
  editedText: string | null;
  humanNotes: string | null;             // micro-directive for next chunk

  // Canonical text (what downstream processes use)
  // = editedText if edited, generatedText if accepted
}
```

### 1.6 Narrative IR (Phase 2)

Extracted asynchronously after scene drafting. Human-verified.

```typescript
interface NarrativeIR {
  sceneId: string;
  verified: boolean;                     // human has confirmed accuracy

  // Delta-based tracking (NOT cumulative)
  events: string[];                      // 3-10 atomic events
  factsIntroduced: string[];             // new truths created
  factsRevealedToReader: string[];
  factsWithheld: string[];

  // Character deltas (ONLY what changed in THIS scene)
  characterDeltas: CharacterDelta[];

  // Setups & Payoffs
  setupsPlanted: string[];
  payoffsExecuted: string[];

  // State at scene exit
  characterPositions: Record<string, string>;
  unresolvedTensions: string[];
}

interface CharacterDelta {
  characterId: string;
  learned: string | null;                // "Marcus learns Elena lied"
  suspicionGained: string | null;
  emotionalShift: string | null;
  relationshipChange: string | null;     // "trust toward Elena drops"
}
```

### 1.7 Audit Flag

```typescript
interface AuditFlag {
  id: string;
  sceneId: string;
  severity: "critical" | "warning" | "info";
  category: string;                      // "kill_list" | "epistemic_leak" | "voice_drift" | etc.
  message: string;
  lineReference: string | null;
  resolved: boolean;
  resolvedAction: string | null;         // what the human did about it

  // Trust tracking
  wasActionable: boolean | null;         // set after human resolves (or ignores)
}
```

### 1.8 Compilation Log

Every LLM call is logged for future analysis.

```typescript
interface CompilationLog {
  id: string;
  chunkId: string;
  payloadHash: string;

  // Budget breakdown (for debugging context allocation)
  ring1Tokens: number;
  ring2Tokens: number;                   // 0 in Phase 0
  ring3Tokens: number;
  totalTokens: number;
  availableBudget: number;

  // What was included
  ring1Contents: string[];               // e.g., ["prose_genome", "kill_list", "positive_exemplar_1"]
  ring3Contents: string[];               // e.g., ["scene_plan", "voice_marcus", "voice_elena", "sensory_bar", "bridge"]

  // Linter results
  lintWarnings: string[];
  lintErrors: string[];

  timestamp: string;
}
```

---

## 2. The Context Compiler

### 2.1 Architecture

The compiler is a pure function: structured inputs → compiled prompt payload.

```
Inputs:
  Bible (latest version)
  ScenePlan
  Previous Chunks (canonical text)
  CompilationConfig
                    │
                    ▼
            ┌───────────────┐
            │  Ring Builder  │
            │                │
            │  buildRing1()  │  → global voice + constraints
            │  buildRing2()  │  → chapter context (Phase 1+)
            │  buildRing3()  │  → scene specifics + voices + bridge
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Budget       │
            │  Enforcer     │
            │                │
            │  Token count   │
            │  Priority trim │
            │  Hard caps     │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Linter       │
            │                │
            │  Priming risk  │
            │  Missing voice │
            │  Budget health │
            │  Subtext check │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Assembler    │
            │                │
            │  System msg    │
            │  User msg      │
            │  Gen params    │
            └───────┬───────┘
                    │
                    ▼
              CompiledPayload
```

### 2.2 Compilation Config

```typescript
interface CompilationConfig {
  // Model constraints
  modelContextWindow: number;            // e.g., 200000
  reservedForOutput: number;             // e.g., 2000 (~800 words)

  // Ring budgets (as fractions of available context)
  ring1MaxFraction: number;              // default 0.15, hard cap
  ring2MaxFraction: number;              // default 0.25
  ring3MinFraction: number;              // default 0.60, floor not ceiling

  // Ring 1 hard cap (absolute token count)
  ring1HardCap: number;                  // e.g., 2000 tokens

  // Continuity bridge
  bridgeVerbatimTokens: number;          // default 200
  bridgeIncludeStateBullets: boolean;    // default true (requires IR, Phase 2+)

  // Anti-ablation
  maxNegativeExemplarTokens: number;     // per exemplar, default 80
  maxNegativeExemplars: number;          // default 2
  maxPositiveExemplars: number;          // default 2

  // Generation parameters (overridable per scene type)
  defaultTemperature: number;            // 0.8
  defaultTopP: number;                   // 0.92
  sceneTypeOverrides: Record<string, { temperature: number; topP: number }>;
}
```

### 2.3 Ring 1 Builder (Global Voice)

Ring 1 is the system message. It applies to every generation call in the project. It must be **tight and sharp** — every token must earn its place.

```typescript
function buildRing1(bible: Bible, config: CompilationConfig): string {
  const sections: string[] = [];

  // --- Prose Genome ---
  if (bible.styleGuide.metaphoricRegister) {
    const mr = bible.styleGuide.metaphoricRegister;
    sections.push(
      `METAPHORS: Draw from ${mr.approvedDomains.join(", ")}. ` +
      `Never: ${mr.prohibitedDomains.join(", ")}.`
    );
  }

  if (bible.styleGuide.vocabularyPreferences.length > 0) {
    const prefs = bible.styleGuide.vocabularyPreferences
      .map(v => `"${v.preferred}" not "${v.insteadOf}"`)
      .join(" | ");
    sections.push(`VOCABULARY: ${prefs}`);
  }

  if (bible.styleGuide.sentenceArchitecture) {
    const sa = bible.styleGuide.sentenceArchitecture;
    const parts: string[] = [];
    if (sa.targetVariance) parts.push(sa.targetVariance);
    if (sa.fragmentPolicy) parts.push(`Fragments: ${sa.fragmentPolicy}`);
    if (sa.notes) parts.push(sa.notes);
    sections.push(`SENTENCES: ${parts.join(". ")}`);
  }

  if (bible.styleGuide.paragraphPolicy) {
    const pp = bible.styleGuide.paragraphPolicy;
    const parts: string[] = [];
    if (pp.maxSentences) parts.push(`Max ${pp.maxSentences} sentences`);
    if (pp.singleSentenceFrequency) parts.push(`Singles: ${pp.singleSentenceFrequency}`);
    if (pp.notes) parts.push(pp.notes);
    sections.push(`PARAGRAPHS: ${parts.join(". ")}`);
  }

  // --- Kill List (mechanical enforcement) ---
  if (bible.styleGuide.killList.length > 0) {
    const kills = bible.styleGuide.killList
      .filter(k => k.type === "exact")
      .map(k => `"${k.pattern}"`)
      .join(" | ");
    sections.push(`NEVER WRITE: ${kills}`);
  }

  // --- Structural Bans ---
  if (bible.styleGuide.structuralBans.length > 0) {
    sections.push(
      `STRUCTURAL RULES:\n` +
      bible.styleGuide.structuralBans.map(b => `- ${b}`).join("\n")
    );
  }

  // --- Negative Exemplars (short, capped) ---
  const negExemplars = bible.styleGuide.negativeExemplars
    .slice(0, config.maxNegativeExemplars);
  if (negExemplars.length > 0) {
    sections.push(
      `DO NOT SOUND LIKE THIS:\n` +
      negExemplars.map(e => `"${e.text}"`).join("\n")
    );
  }

  // --- Positive Exemplars ---
  const posExemplars = bible.styleGuide.positiveExemplars
    .slice(0, config.maxPositiveExemplars);
  if (posExemplars.length > 0) {
    sections.push(
      `THE VOICE SOUNDS LIKE THIS:\n` +
      posExemplars.map(e => `"${e.text}"`).join("\n")
    );
  }

  // --- POV Contract ---
  if (bible.narrativeRules.pov) {
    const pov = bible.narrativeRules.pov;
    sections.push(
      `POV: ${pov.default}, ${pov.distance} distance. ` +
      `Interiority: ${pov.interiority}. ` +
      `Narrator: ${pov.reliability}.` +
      (pov.notes ? ` ${pov.notes}` : "")
    );
  }

  // --- Core narrative rules ---
  const rules: string[] = [];
  if (bible.narrativeRules.subtextPolicy) {
    rules.push(bible.narrativeRules.subtextPolicy);
  }
  if (bible.narrativeRules.expositionPolicy) {
    rules.push(bible.narrativeRules.expositionPolicy);
  }
  if (bible.narrativeRules.sceneEndingPolicy) {
    rules.push(bible.narrativeRules.sceneEndingPolicy);
  }
  if (rules.length > 0) {
    sections.push(`NARRATIVE RULES: ${rules.join(". ")}`);
  }

  const ring1 = `=== PROJECT VOICE ===\n\n${sections.join("\n\n")}`;

  // --- Hard cap enforcement ---
  const tokens = countTokens(ring1);
  if (tokens > config.ring1HardCap) {
    console.warn(`Ring 1 at ${tokens} tokens, cap is ${config.ring1HardCap}. Trimming.`);
    return truncateToTokens(ring1, config.ring1HardCap);
  }

  return ring1;
}
```

### 2.4 Ring 2 Builder (Chapter Context) — Phase 1+

```typescript
function buildRing2(
  chapterArc: ChapterArc,
  bible: Bible,
  activeCharacterIds: string[],
  previousSceneIRs: NarrativeIR[],       // from earlier scenes in this chapter
  config: CompilationConfig
): string {
  const sections: string[] = [];

  // Chapter brief
  sections.push(
    `=== CHAPTER ${chapterArc.chapterNumber}: ${chapterArc.workingTitle} ===\n` +
    `Function: ${chapterArc.narrativeFunction}\n` +
    `Register: ${chapterArc.dominantRegister}\n` +
    `Pacing: ${chapterArc.pacingTarget}\n` +
    `Ending: ${chapterArc.endingPosture}`
  );

  // Reader state at chapter entry
  const rs = chapterArc.readerStateEntering;
  sections.push(
    `READER STATE (entering chapter):\n` +
    `Knows: ${rs.knows.join("; ")}\n` +
    `Suspects: ${rs.suspects.join("; ")}\n` +
    `Wrong about: ${rs.wrongAbout.join("; ")}\n` +
    `Active tensions: ${rs.activeTensions.join("; ")}`
  );

  // Reconstruct character epistemic state from IR deltas
  for (const charId of activeCharacterIds) {
    const char = bible.characters.find(c => c.id === charId);
    if (!char) continue;

    const deltas = previousSceneIRs
      .flatMap(ir => ir.characterDeltas)
      .filter(d => d.characterId === charId);

    if (deltas.length > 0) {
      sections.push(
        `${char.name.toUpperCase()} — state entering this scene:\n` +
        deltas.map(d => {
          const parts: string[] = [];
          if (d.learned) parts.push(`Learned: ${d.learned}`);
          if (d.suspicionGained) parts.push(`Suspects: ${d.suspicionGained}`);
          if (d.emotionalShift) parts.push(`Emotional: ${d.emotionalShift}`);
          if (d.relationshipChange) parts.push(`Relationship: ${d.relationshipChange}`);
          return parts.join(". ");
        }).join("\n")
      );
    }
  }

  // Active setups that should be tracked
  const activeSetups = bible.narrativeRules.setups
    .filter(s => s.status === "planted" || s.status === "planned");
  if (activeSetups.length > 0) {
    sections.push(
      `ACTIVE SETUPS (track these):\n` +
      activeSetups.map(s => `- ${s.description} [${s.status}]`).join("\n")
    );
  }

  return `${sections.join("\n\n")}`;
}
```

### 2.5 Ring 3 Builder (Scene Precision)

Ring 3 gets the majority of context budget. This is where voice holds or breaks.

```typescript
function buildRing3(
  plan: ScenePlan,
  bible: Bible,
  previousChunks: Chunk[],
  chunkNumber: number,
  config: CompilationConfig
): string {
  const sections: string[] = [];

  // --- Scene Contract ---
  sections.push(formatSceneContract(plan));

  // --- Full Voice Fingerprints for Speaking Characters ---
  const speakingCharIds = Object.keys(plan.dialogueConstraints);
  // Always include POV character
  if (!speakingCharIds.includes(plan.povCharacterId)) {
    speakingCharIds.unshift(plan.povCharacterId);
  }

  for (const charId of speakingCharIds) {
    const char = bible.characters.find(c => c.id === charId);
    if (!char) continue;

    const voiceBlock = formatCharacterVoice(char, plan.dialogueConstraints[charId] || []);
    sections.push(voiceBlock);
  }

  // --- Sensory Palette ---
  if (plan.locationId) {
    const location = bible.locations.find(l => l.id === plan.locationId);
    if (location) {
      sections.push(formatSensoryPalette(location));
    }
  }

  // --- Human Anchor Lines ---
  if (plan.anchorLines.length > 0) {
    sections.push(
      `=== ANCHOR LINES (human-authored) ===\n` +
      plan.anchorLines.map(a =>
        `"${a.text}"\n` +
        `Placement: ${a.placement}. ${a.verbatim ? "USE VERBATIM." : "Match energy; exact wording optional."}`
      ).join("\n\n")
    );
  }

  // --- Continuity Bridge (Two-Part) ---
  if (previousChunks.length > 0) {
    const lastChunk = previousChunks[previousChunks.length - 1];
    const canonText = lastChunk.editedText || lastChunk.generatedText;

    // Part A: Small verbatim excerpt (rhythm continuity)
    const verbatim = lastNTokens(canonText, config.bridgeVerbatimTokens);
    sections.push(`=== PRECEDING TEXT (match rhythm and continuity) ===\n${verbatim}`);

    // Part B: Structured state bullets (Phase 2, when IR is available)
    // if (config.bridgeIncludeStateBullets && sceneIR) {
    //   sections.push(formatIRBridge(sceneIR));
    // }
  }

  // --- Anti-Ablation Directives ---
  sections.push(formatAntiAblation(plan));

  // --- Micro-Directive from Human ---
  if (previousChunks.length > 0) {
    const lastChunk = previousChunks[previousChunks.length - 1];
    if (lastChunk.humanNotes) {
      sections.push(`=== DIRECTION FOR THIS SECTION ===\n${lastChunk.humanNotes}`);
    }
  }

  return sections.join("\n\n");
}

// --- Helper: Format Scene Contract ---
function formatSceneContract(plan: ScenePlan): string {
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
      `RULE: ${plan.subtext.enforcementRule}`
    );
  }

  if (plan.readerStateEntering) {
    const rs = plan.readerStateEntering;
    lines.push(
      `\nREADER ENTERING:`,
      `Knows: ${rs.knows.join("; ")}`,
      `Suspects: ${rs.suspects.join("; ")}`,
      `Wrong about: ${rs.wrongAbout.join("; ")}`
    );
  }

  if (plan.readerStateExiting) {
    const rs = plan.readerStateExiting;
    lines.push(
      `\nREADER EXITING:`,
      `Should now know: ${rs.knows.join("; ")}`,
      `Should now suspect: ${rs.suspects.join("; ")}`
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

// --- Helper: Format Character Voice ---
function formatCharacterVoice(
  char: CharacterDossier,
  sceneConstraints: string[]
): string {
  const v = char.voice;
  const lines: string[] = [
    `=== ${char.name.toUpperCase()} — VOICE ===`
  ];

  if (v.sentenceLengthRange) {
    lines.push(`Sentence length: ${v.sentenceLengthRange[0]}-${v.sentenceLengthRange[1]} words`);
  }
  if (v.vocabularyNotes) {
    lines.push(`Vocabulary: ${v.vocabularyNotes}`);
  }
  if (v.verbalTics.length > 0) {
    lines.push(`Tics: ${v.verbalTics.join("; ")}`);
  }
  if (v.metaphoricRegister) {
    lines.push(`Metaphors from: ${v.metaphoricRegister}`);
  }
  if (v.prohibitedLanguage.length > 0) {
    lines.push(`Never says: ${v.prohibitedLanguage.join(", ")}`);
  }

  // Dialogue samples (strongest conditioning signal)
  if (v.dialogueSamples.length > 0) {
    lines.push(`\nVoice samples:`);
    for (const sample of v.dialogueSamples) {
      lines.push(`  "${sample}"`);
    }
  }

  // Scene-specific constraints
  if (sceneConstraints.length > 0) {
    lines.push(`\nIn this scene:`);
    for (const constraint of sceneConstraints) {
      lines.push(`- ${constraint}`);
    }
  }

  // Behavioral cues (if available, for POV character especially)
  if (char.behavior) {
    const b = char.behavior;
    const behaviorParts: string[] = [];
    if (b.emotionPhysicality) behaviorParts.push(`Body shows emotion: ${b.emotionPhysicality}`);
    if (b.stressResponse) behaviorParts.push(`Under stress: ${b.stressResponse}`);
    if (behaviorParts.length > 0) {
      lines.push(`\n${behaviorParts.join("\n")}`);
    }
  }

  return lines.join("\n");
}

// --- Helper: Format Sensory Palette ---
function formatSensoryPalette(location: Location): string {
  const sp = location.sensoryPalette;
  const lines: string[] = [
    `=== LOCATION: ${location.name} ===`
  ];

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

// --- Helper: Format Anti-Ablation ---
function formatAntiAblation(plan: ScenePlan): string {
  const lines: string[] = [`=== ANTI-ABLATION ===`];

  // Scene-specific prohibitions
  if (plan.sceneSpecificProhibitions.length > 0) {
    lines.push(`Scene-specific bans:`);
    for (const p of plan.sceneSpecificProhibitions) {
      lines.push(`- ${p}`);
    }
  }

  // Universal anti-ablation (always present)
  lines.push(`\nGENERAL:`);
  lines.push(`- Do not summarize what just happened.`);
  lines.push(`- Do not have characters explain their own motivations.`);
  lines.push(`- Do not resolve tension unless the scene contract calls for it.`);
  lines.push(`- Subtext must remain sub. If a character states the theme, you have failed.`);
  lines.push(`- Prefer specific, embodied detail over abstract description.`);
  lines.push(`- Vary sentence length. Monotony is failure.`);

  return lines.join("\n");
}
```

### 2.6 Payload Assembly

```typescript
interface CompiledPayload {
  systemMessage: string;                 // Ring 1
  userMessage: string;                   // Ring 2 + Ring 3 + Generation Instruction
  temperature: number;
  topP: number;
  maxTokens: number;
  model: string;
}

function compilePayload(
  bible: Bible,
  plan: ScenePlan,
  chapterArc: ChapterArc | null,         // null in Phase 0
  previousChunks: Chunk[],
  previousSceneIRs: NarrativeIR[],        // empty in Phase 0
  chunkNumber: number,
  config: CompilationConfig
): { payload: CompiledPayload; log: CompilationLog } {

  // Build rings
  const ring1 = buildRing1(bible, config);
  const ring2 = chapterArc
    ? buildRing2(chapterArc, bible, getActiveCharIds(plan), previousSceneIRs, config)
    : "";
  const ring3 = buildRing3(plan, bible, previousChunks, chunkNumber, config);

  // Budget enforcement
  const available = config.modelContextWindow - config.reservedForOutput;
  const { r1, r2, r3 } = enforceBudget(ring1, ring2, ring3, available, config);

  // Lint
  const lintResults = lintPayload(r1, r2, r3, plan, bible, config);

  // Generation instruction
  const chunkDesc = plan.chunkDescriptions[chunkNumber] || "";
  const wordTarget = Math.round(
    (plan.estimatedWordCount[0] + plan.estimatedWordCount[1]) / 2 / plan.chunkCount
  );

  const genInstruction =
    `Write the next section of this scene (~${wordTarget} words). ` +
    `This is section ${chunkNumber + 1} of ${plan.chunkCount}: ${chunkDesc}. ` +
    `Follow all constraints in the scene contract and voice specifications. ` +
    `Do not summarize. Do not resolve tension unless the plan calls for it. ` +
    `Do not make subtext into text. Do not explain what characters are feeling — show it.`;

  // Assemble user message
  const userMessage = [r2, r3, genInstruction].filter(Boolean).join("\n\n---\n\n");

  // Select generation parameters
  const params = selectParams(plan, config);

  // Build log
  const payload: CompiledPayload = {
    systemMessage: r1,
    userMessage,
    temperature: params.temperature,
    topP: params.topP,
    maxTokens: config.reservedForOutput,
    model: params.model || "claude-sonnet-4-5-20250514"
  };

  const log: CompilationLog = {
    id: generateId(),
    chunkId: `${plan.id}_chunk${chunkNumber}`,
    payloadHash: hashPayload(payload),
    ring1Tokens: countTokens(r1),
    ring2Tokens: countTokens(r2),
    ring3Tokens: countTokens(r3),
    totalTokens: countTokens(r1) + countTokens(r2) + countTokens(r3),
    availableBudget: available,
    ring1Contents: identifyRing1Contents(r1),
    ring3Contents: identifyRing3Contents(r3),
    lintWarnings: lintResults.warnings.map(w => w.message),
    lintErrors: lintResults.errors.map(e => e.message),
    timestamp: new Date().toISOString()
  };

  return { payload, log };
}
```

### 2.7 Budget Enforcement

```typescript
function enforceBudget(
  ring1: string,
  ring2: string,
  ring3: string,
  availableTokens: number,
  config: CompilationConfig
): { r1: string; r2: string; r3: string } {

  let r1 = ring1;
  let r2 = ring2;
  let r3 = ring3;

  // Step 1: Ring 1 hard cap (absolute, regardless of total budget)
  if (countTokens(r1) > config.ring1HardCap) {
    r1 = truncateToTokens(r1, config.ring1HardCap);
  }

  // Step 2: Check total
  const total = countTokens(r1) + countTokens(r2) + countTokens(r3);
  if (total <= availableTokens) return { r1, r2, r3 };

  // Step 3: Compress. Priority order: Ring 1 → Ring 2 → Ring 3 (last resort)
  const overage = total - availableTokens;
  let remaining = overage;

  // Compress Ring 1 (remove exemplars first, then vocab prefs, then structural details)
  const r1Tokens = countTokens(r1);
  const r1Compressible = r1Tokens - countTokens(extractImmune(r1, "ring1"));
  if (remaining > 0 && r1Compressible > 0) {
    const cut = Math.min(remaining, r1Compressible);
    r1 = compressRing(r1, r1Tokens - cut, RING1_COMPRESSION_PRIORITY);
    remaining -= cut;
  }

  // Compress Ring 2 (remove relationship details, then setup registry, then reader state)
  if (remaining > 0 && r2) {
    const r2Tokens = countTokens(r2);
    const cut = Math.min(remaining, r2Tokens * 0.5);  // never cut more than half
    r2 = compressRing(r2, r2Tokens - cut, RING2_COMPRESSION_PRIORITY);
    remaining -= cut;
  }

  // Ring 3: only trim sensory palette and bridge length. NEVER trim:
  // - scene contract
  // - voice fingerprints for speaking characters
  // - human anchor lines
  // - anti-ablation directives
  if (remaining > 0) {
    const r3Tokens = countTokens(r3);
    r3 = compressRing(r3, r3Tokens - remaining, RING3_COMPRESSION_PRIORITY);
  }

  return { r1, r2, r3 };
}

// Compression never touches these:
const NEVER_COMPRESS = {
  ring1: ["kill_list"],
  ring3: ["scene_contract", "voice_fingerprints", "anchor_lines", "anti_ablation", "subtext_contract"]
};
```

### 2.8 Context Linter

```typescript
interface LintResult {
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
}

function lintPayload(
  ring1: string,
  ring2: string,
  ring3: string,
  plan: ScenePlan,
  bible: Bible,
  config: CompilationConfig
): LintResult {
  const warnings: Array<{ code: string; message: string }> = [];
  const errors: Array<{ code: string; message: string }> = [];

  // Ring 1 overbudget
  const r1Tokens = countTokens(ring1);
  if (r1Tokens > config.ring1HardCap) {
    errors.push({
      code: "R1_OVER_CAP",
      message: `Ring 1 at ${r1Tokens} tokens (cap: ${config.ring1HardCap}). ` +
               `Remove exemplars or vocabulary preferences.`
    });
  }

  // Ring 3 underbudget (scene context being starved)
  const totalTokens = countTokens(ring1) + countTokens(ring2) + countTokens(ring3);
  const available = config.modelContextWindow - config.reservedForOutput;
  const r3Fraction = countTokens(ring3) / available;
  if (r3Fraction < 0.4) {
    warnings.push({
      code: "R3_STARVED",
      message: `Ring 3 only ${(r3Fraction * 100).toFixed(0)}% of budget. Scene context may be insufficient.`
    });
  }

  // Negative exemplar priming risk
  for (const exemplar of bible.styleGuide.negativeExemplars) {
    if (countTokens(exemplar.text) > config.maxNegativeExemplarTokens) {
      warnings.push({
        code: "NEG_EXEMPLAR_LONG",
        message: `Negative exemplar "${exemplar.text.slice(0, 40)}..." exceeds ` +
                 `${config.maxNegativeExemplarTokens} token cap. Shorten or convert to structural ban.`
      });
    }
  }

  // Missing voice for speaking character
  const speakingCharIds = Object.keys(plan.dialogueConstraints);
  for (const charId of speakingCharIds) {
    const char = bible.characters.find(c => c.id === charId);
    if (!char || char.voice.dialogueSamples.length === 0) {
      warnings.push({
        code: "MISSING_VOICE_SAMPLES",
        message: `Character ${charId} speaks in this scene but has no dialogue samples. ` +
                 `Voice will drift toward generic.`
      });
    }
  }

  // Subtext contract missing for dialogue scene
  if (speakingCharIds.length >= 2 && !plan.subtext) {
    warnings.push({
      code: "MISSING_SUBTEXT",
      message: `Multi-character dialogue scene has no subtext contract. High ablation risk.`
    });
  }

  // No failure mode specified
  if (!plan.failureModeToAvoid) {
    warnings.push({
      code: "NO_FAILURE_MODE",
      message: `No failure mode specified. The compiler can't protect against unknown risks.`
    });
  }

  return { warnings, errors };
}
```

---

## 3. The Auditor

### 3.1 Phase 0: Mechanical Audits Only

No IR. No LLM-assisted analysis. Just pattern matching against prose.

```typescript
class AuditorLite {

  // --- Kill List Scan (regex, instant) ---
  checkKillList(prose: string, killList: KillListEntry[]): AuditFlag[] {
    const flags: AuditFlag[] = [];

    for (const entry of killList) {
      if (entry.type !== "exact") continue;

      const regex = new RegExp(escapeRegex(entry.pattern), "gi");
      const matches = [...prose.matchAll(regex)];

      for (const match of matches) {
        flags.push({
          id: generateId(),
          sceneId: "",  // set by caller
          severity: "critical",
          category: "kill_list",
          message: `Kill list violation: "${entry.pattern}" found.`,
          lineReference: getLineReference(prose, match.index!),
          resolved: false,
          resolvedAction: null,
          wasActionable: null
        });
      }
    }

    return flags;
  }

  // --- Sentence Length Variance ---
  checkSentenceVariance(prose: string, targetVariance?: number): AuditFlag[] {
    const flags: AuditFlag[] = [];
    const sentences = splitSentences(prose);
    const lengths = sentences.map(s => countWords(s));

    if (lengths.length < 5) return flags;  // too short to measure

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = Math.sqrt(
      lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length
    );

    // Flag low variance (rhythmic monotony)
    if (variance < 3.0) {
      flags.push({
        id: generateId(),
        sceneId: "",
        severity: "warning",
        category: "rhythm_monotony",
        message: `Sentence length variance is ${variance.toFixed(1)} (target: >3.0). ` +
                 `Prose may feel rhythmically flat.`,
        lineReference: null,
        resolved: false,
        resolvedAction: null,
        wasActionable: null
      });
    }

    // Flag consecutive same-length sentences (3+ in a row within ±2 words)
    for (let i = 0; i < lengths.length - 2; i++) {
      if (Math.abs(lengths[i] - lengths[i + 1]) <= 2 &&
          Math.abs(lengths[i + 1] - lengths[i + 2]) <= 2) {
        flags.push({
          id: generateId(),
          sceneId: "",
          severity: "info",
          category: "rhythm_monotony",
          message: `3+ consecutive sentences of similar length near: "${sentences[i].slice(0, 50)}..."`,
          lineReference: getLineReference(prose, prose.indexOf(sentences[i])),
          resolved: false,
          resolvedAction: null,
          wasActionable: null
        });
      }
    }

    return flags;
  }

  // --- Paragraph Length Check ---
  checkParagraphLength(prose: string, maxSentences: number | null): AuditFlag[] {
    if (!maxSentences) return [];

    const flags: AuditFlag[] = [];
    const paragraphs = prose.split(/\n\n+/);

    for (const para of paragraphs) {
      const sentenceCount = splitSentences(para).length;
      if (sentenceCount > maxSentences) {
        flags.push({
          id: generateId(),
          sceneId: "",
          severity: "warning",
          category: "paragraph_length",
          message: `Paragraph has ${sentenceCount} sentences (max: ${maxSentences}): ` +
                   `"${para.slice(0, 60)}..."`,
          lineReference: getLineReference(prose, prose.indexOf(para)),
          resolved: false,
          resolvedAction: null,
          wasActionable: null
        });
      }
    }

    return flags;
  }

  // --- Basic Metrics (info-level, no flags) ---
  computeMetrics(prose: string): ProseMetrics {
    const words = countWords(prose);
    const sentences = splitSentences(prose);
    const uniqueWords = new Set(prose.toLowerCase().match(/\b\w+\b/g) || []);
    const allWords = prose.toLowerCase().match(/\b\w+\b/g) || [];

    return {
      wordCount: words,
      sentenceCount: sentences.length,
      averageSentenceLength: words / sentences.length,
      sentenceLengthStdDev: computeVariance(sentences.map(s => countWords(s))),
      typeTokenRatio: uniqueWords.size / allWords.length,
      paragraphCount: prose.split(/\n\n+/).length,
      averageParagraphLength: sentences.length / prose.split(/\n\n+/).length
    };
  }
}

interface ProseMetrics {
  wordCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
  sentenceLengthStdDev: number;
  typeTokenRatio: number;
  paragraphCount: number;
  averageParagraphLength: number;
}
```

### 3.2 Phase 1: Auditor with IR (LLM-Assisted)

Once IR extraction exists, add:

```typescript
class AuditorFull extends AuditorLite {

  // --- Epistemic Leak Detection (IR-driven) ---
  checkEpistemicLeaks(
    sceneIR: NarrativeIR,
    allPriorIRs: NarrativeIR[],
    bible: Bible
  ): AuditFlag[] {
    const flags: AuditFlag[] = [];

    // Reconstruct character states by replaying deltas
    for (const delta of sceneIR.characterDeltas) {
      const priorDeltas = allPriorIRs
        .flatMap(ir => ir.characterDeltas)
        .filter(d => d.characterId === delta.characterId);

      // Check: if this character "learned" something, was it available to learn?
      if (delta.learned) {
        const couldHaveKnown = priorDeltas.some(d =>
          d.learned?.includes(delta.learned!) ||
          sceneIR.factsRevealedToReader.includes(delta.learned!)
        );

        // If it wasn't in the scene's revealed facts AND wasn't prior knowledge...
        if (!couldHaveKnown && !sceneIR.factsIntroduced.includes(delta.learned)) {
          flags.push({
            id: generateId(),
            sceneId: sceneIR.sceneId,
            severity: "critical",
            category: "epistemic_leak",
            message: `${delta.characterId} references "${delta.learned}" but has no source.`,
            lineReference: null,
            resolved: false,
            resolvedAction: null,
            wasActionable: null
          });
        }
      }
    }

    return flags;
  }

  // --- Subtext Compliance (LLM-assisted) ---
  async checkSubtext(
    prose: string,
    subtextContract: ScenePlan["subtext"]
  ): Promise<AuditFlag[]> {
    if (!subtextContract) return [];

    // Ask LLM: "Does any character explicitly state the subtext?"
    const prompt = `Analyze this prose for subtext compliance.

The scene contract specifies:
- Surface conversation: ${subtextContract.surfaceConversation}
- Actual conversation: ${subtextContract.actualConversation}
- Rule: ${subtextContract.enforcementRule}

PROSE:
${prose}

Does any character explicitly state the subtext (the "actual conversation")?
Does any character explain what the scene is "really about"?
Respond with JSON: { "violations": [{ "line": "quoted text", "reason": "why this violates subtext" }] }
If no violations, respond: { "violations": [] }`;

    const response = await this.llmCall(prompt, { temperature: 0.1 });
    const result = parseJSON(response);

    return (result.violations || []).map((v: any) => ({
      id: generateId(),
      sceneId: "",
      severity: "critical" as const,
      category: "subtext_violation",
      message: `Subtext made text: "${v.line}" — ${v.reason}`,
      lineReference: v.line,
      resolved: false,
      resolvedAction: null,
      wasActionable: null
    }));
  }

  // --- Setup/Payoff Tracking (IR-driven) ---
  checkSetupPayoff(
    sceneIR: NarrativeIR,
    plan: ScenePlan,
    allSetups: SetupEntry[]
  ): AuditFlag[] {
    const flags: AuditFlag[] = [];

    // Check: were planned setups actually planted?
    for (const directive of plan.setupsToPlant || []) {
      if (!sceneIR.setupsPlanted.includes(directive.setupId)) {
        flags.push({
          id: generateId(),
          sceneId: sceneIR.sceneId,
          severity: "warning",
          category: "setup_missing",
          message: `Setup "${directive.description}" was planned for this scene but IR doesn't show it planted.`,
          lineReference: null,
          resolved: false,
          resolvedAction: null,
          wasActionable: null
        });
      }
    }

    // Check: were planned payoffs delivered?
    for (const payoffId of plan.payoffsToDeliver || []) {
      if (!sceneIR.payoffsExecuted.includes(payoffId)) {
        flags.push({
          id: generateId(),
          sceneId: sceneIR.sceneId,
          severity: "warning",
          category: "payoff_missing",
          message: `Payoff for setup "${payoffId}" was planned but IR doesn't show it delivered.`,
          lineReference: null,
          resolved: false,
          resolvedAction: null,
          wasActionable: null
        });
      }
    }

    return flags;
  }
}
```

---

## 4. Bootstrap Mode

The user's first interaction. They paste a synopsis and the system hydrates a draft bible.

### 4.1 Flow

```
User pastes raw synopsis (free text, any length)
        │
        ▼
System sends to LLM with structured extraction prompt
        │
        ▼
LLM returns draft Bible JSON:
  - Characters found (with proposed voice notes)
  - Locations found (with proposed sensory palettes)
  - Narrative tone detected (proposed style guide)
  - Suggested kill list (genre-appropriate defaults)
        │
        ▼
System populates Bible editor with draft values
        │
        ▼
User edits what matters, leaves the rest
        │
        ▼
User writes 3-5 dialogue samples per major character
(this is the ONE thing the system can't bootstrap — 
human voice anchors are irreplaceable)
        │
        ▼
Bible v1 approved → ready to plan
```

### 4.2 Bootstrap Prompt

```typescript
function buildBootstrapPrompt(synopsis: string): string {
  return `You are a literary analyst. Given this synopsis, extract structured elements 
for a story bible. Be specific and opinionated — generic descriptions are useless.

SYNOPSIS:
${synopsis}

Extract the following as JSON:

{
  "characters": [
    {
      "name": "...",
      "role": "protagonist|antagonist|supporting|minor",
      "physicalDescription": "Specific. Not 'tall and handsome.' What does the reader SEE?",
      "backstory": "Brief but specific.",
      "voiceNotes": "How does this person TALK? Short sentences or long? Formal or casual? What words would they never use?",
      "emotionPhysicality": "How does their body show emotion? Not 'she felt sad' — what does sad LOOK like on this person?"
    }
  ],
  "locations": [
    {
      "name": "...",
      "sensoryPalette": {
        "sounds": ["specific sounds, not generic"],
        "smells": ["specific smells"],
        "textures": ["what do hands touch here?"],
        "lightQuality": "What does the light do?",
        "prohibitedDefaults": ["generic sensory details to avoid for this location"]
      }
    }
  ],
  "suggestedTone": {
    "metaphoricDomains": ["where do this story's metaphors come from?"],
    "prohibitedDomains": ["what metaphoric territory is too generic for this story?"],
    "pacingNotes": "Fast? Slow? Variable?",
    "interiority": "How deep in characters' heads are we?"
  },
  "suggestedKillList": [
    "genre-appropriate banned phrases — the clichés this specific story must avoid"
  ]
}

Be ruthlessly specific. If the synopsis doesn't give you enough to be specific, 
make a strong opinionated choice and flag it as [ASSUMPTION] so the author can override.`;
}
```

---

## 5. UI Architecture

### 5.1 Phase 0 UI: The Cockpit

Three panes. No forms. JSON + editor + compiler view.

```
┌─────────────────────────────────────────────────────────────┐
│  NARRATIVE ORCHESTRATOR — Phase 0 Cockpit                   │
├──────────────┬──────────────────┬───────────────────────────┤
│              │                  │                           │
│  BIBLE       │  DRAFTING DESK   │  COMPILER VIEW            │
│  (JSON)      │                  │  (what the LLM sees)      │
│              │  [chunk 1 text]  │                           │
│  {           │                  │  ═══ SYSTEM MESSAGE ═══   │
│    "style":  │  ──── boundary ──│  Ring 1: 847 tokens       │
│    {         │                  │                           │
│      "kill": │  [chunk 2 text]  │  METAPHORS: Draw from...  │
│      [       │                  │  VOCABULARY: "calcified"  │
│        "a    │  ──── boundary ──│  ...                      │
│        sense │                  │                           │
│        of",  │  [generating...] │  ═══ USER MESSAGE ═══     │
│        ...   │  ████████░░ 78%  │  Ring 3: 2,140 tokens     │
│      ]       │                  │                           │
│    }         │                  │  === SCENE CONTRACT ===   │
│  }           │                  │  POV: Marcus, close third │
│              │                  │  Goal: Establish...       │
│  SCENE PLAN  │  ┌────────────┐ │  ...                      │
│  (JSON)      │  │ ✓ Accept   │ │                           │
│              │  │ ✏️ Edit     │ │  === MARCUS VOICE ===     │
│  {           │  │ ↻ Regen    │ │  Sentences: 6-14 words    │
│    "title":  │  │            │ │  ...                      │
│    "The Bar" │  │ Notes:     │ │                           │
│    ...       │  │ [________] │ │  Budget: 2987/4000 tokens │
│  }           │  └────────────┘ │  R1: 28% R3: 72%          │
│              │                  │                           │
│ [Bootstrap]  │                  │  Lint: 0 errors, 1 warn   │
│ [Load JSON]  │                  │  ⚠ NEG_EXEMPLAR_LONG      │
│ [Save]       │                  │                           │
└──────────────┴──────────────────┴───────────────────────────┘
```

**Why the Compiler View matters:** You need to see exactly what's being sent to the LLM. This is your debugging interface. If the prose is drifting, the answer is almost always in the payload — a missing voice fingerprint, a bloated Ring 1, a bridge carrying forward weak phrasing. You can't fix what you can't see.

### 5.2 Phase 1 UI: Structured Editors

Replace JSON panes with form-based editors. Add:

- **Bible editor:** Structured fields with "Expand with AI" buttons
- **Planner view:** Visual scene sequence with status indicators
- **Audit panel:** Flags with jump-to-text and resolve actions
- **Metrics sidebar:** Live sentence variance, type-token ratio, word count vs. target

### 5.3 Phase 2 UI: Full System

- **Forward simulator:** Reader state trace visualization
- **IR inspector:** View and edit extracted IR per scene
- **Cross-chapter dashboard:** Setup/payoff tracking, voice drift over distance
- **Revision learner panel:** Pattern summaries, proposed bible updates

---

## 6. Build Phases (Detailed)

### Phase 0: Single Scene Lab Test

**Goal:** Prove that Bible + Scene Plan → superior prose.

**Build:**
1. Data model (TypeScript interfaces): `Bible`, `ScenePlan`, `Chunk`
2. Context compiler: `buildRing1()` + `buildRing3()` + `compilePayload()`
3. Budget enforcer + linter
4. LLM interface (direct Anthropic SDK call)
5. Cockpit UI (three-pane: JSON / drafting desk / compiler view)
6. Auditor Lite: kill list scan + sentence variance + paragraph length
7. Bootstrap mode: synopsis → draft bible

**Don't build:**
- Chapter arcs, Ring 2, IR, revision learner, forward simulation
- Structured form editors (JSON is fine for power users)
- Database (filesystem is fine for one scene)

**Test protocol:**
1. Create a mock bible (2 characters, 1 location, style guide with kill list)
2. Create a scene plan (dialogue-heavy, with subtext contract and anchor line)
3. Generate 3 chunks with human review at each gate
4. Run auditor
5. **Compare against baseline:** same scene description, no bible, no plan, generic prompt

**Success criteria:**
- Kill list has zero violations in final text
- Sentence length variance > 3.0
- Subtext stays implicit (human judgment)
- Character voices are distinguishable (human judgment)
- Human edits feel like refinement, not salvage

### Phase 1: One Chapter Loop

**Goal:** Prove the full planning → drafting → auditing loop works.

**Add to Phase 0:**
1. SQLite database (bible versions, chunks, compilation logs, audit flags)
2. Chapter arc + scene plan editor (structured forms)
3. Ring 2 builder (chapter context)
4. Chunking with continuity bridge
5. Auditor: trust tracking per category
6. State management: bible versioning, scene status tracking
7. Gate enforcement (all six gates)

**Don't build:**
- IR extraction (manual tracking is fine for one chapter)
- Revision learner (human manually updates bible)
- Cross-chapter audits
- Forward simulation

**Test protocol:**
1. Plan a 4-scene chapter: dialogue, revelation, contemplative, transitional
2. 2-3 characters, 1-2 locations
3. Draft all 4 scenes through the full gated workflow
4. Run chapter-level audit
5. Manually update bible based on what you learned

**Success criteria:**
- Voice holds across 4 scenes (not just 3 chunks)
- Continuity bridge works (no tone whiplash at scene boundaries)
- Audit flags are mostly actionable (track signal-to-noise)
- The workflow reduces bookkeeping vs. doing it manually

### Phase 2: Short Novella Systems Proof

**Goal:** Validate long-horizon behavior.

**Add to Phase 1:**
1. IR extraction (async, LLM-assisted, human-verified)
2. Epistemic leak detection (IR-driven)
3. Setup/payoff registry with cross-chapter tracking
4. Subtext compliance audit (LLM-assisted)
5. Style drift metrics over distance
6. Voice separability measurement
7. Ring 2 with IR-derived character states
8. Two-part continuity bridge (verbatim + IR state bullets)
9. Forward simulation

**Don't build:**
- Revision learner (still manual)
- Genre templates
- Multi-project support

**Test protocol:**
1. Plan a 6-8 chapter novella (20-35k words)
2. 4-6 characters, 3-4 locations
3. At least 3 cross-chapter setups/payoffs
4. Draft through the full workflow
5. Run manuscript-level audit

**Success criteria:**
- Cross-chapter continuity holds
- Epistemic leaks are caught by auditor
- Setup/payoff tracking works across distance
- Style and voice don't drift measurably over 8 chapters
- Ring 1 stays stable (hasn't grown more than 20% from initial)

### Phase 3: Revision Learner + Polish

**Goal:** The system gets smarter over the project lifetime.

**Add:**
1. Diff analysis pipeline (classify human edits)
2. Pattern accumulation and confidence tracking
3. Proposed bible updates from learned patterns
4. Compilation profile auto-tuning
5. Genre template library
6. Multi-project support
7. Export to standard manuscript formats

---

## 7. Database Schema (SQLite)

```sql
-- Core project
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'bootstrap',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Bible (version-controlled)
CREATE TABLE bibles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  data JSON NOT NULL,            -- full Bible JSON
  created_at TEXT NOT NULL,
  UNIQUE(project_id, version)
);

-- Chapter arcs
CREATE TABLE chapter_arcs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  chapter_number INTEGER NOT NULL,
  data JSON NOT NULL,            -- ChapterArc JSON
  created_at TEXT NOT NULL
);

-- Scene plans
CREATE TABLE scene_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  chapter_id TEXT REFERENCES chapter_arcs(id),
  data JSON NOT NULL,            -- ScenePlan JSON
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Chunks (the prose units)
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scene_plans(id),
  sequence_number INTEGER NOT NULL,
  generated_text TEXT NOT NULL,
  edited_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  human_notes TEXT,
  payload_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature REAL NOT NULL,
  top_p REAL NOT NULL,
  generated_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(scene_id, sequence_number)
);

-- Compilation logs (every LLM call)
CREATE TABLE compilation_logs (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES chunks(id),
  payload_hash TEXT NOT NULL,
  ring1_tokens INTEGER NOT NULL,
  ring2_tokens INTEGER NOT NULL,
  ring3_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  available_budget INTEGER NOT NULL,
  ring1_contents JSON,
  ring3_contents JSON,
  lint_warnings JSON,
  lint_errors JSON,
  timestamp TEXT NOT NULL
);

-- Audit flags
CREATE TABLE audit_flags (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scene_plans(id),
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  line_reference TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_action TEXT,
  was_actionable INTEGER,         -- NULL until resolved/dismissed
  created_at TEXT NOT NULL
);

-- Narrative IR (Phase 2)
CREATE TABLE narrative_irs (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scene_plans(id),
  verified INTEGER NOT NULL DEFAULT 0,
  data JSON NOT NULL,            -- NarrativeIR JSON
  created_at TEXT NOT NULL,
  verified_at TEXT
);

-- Compiled payloads (stored for reproducibility)
CREATE TABLE compiled_payloads (
  hash TEXT PRIMARY KEY,
  system_message TEXT NOT NULL,
  user_message TEXT NOT NULL,
  temperature REAL NOT NULL,
  top_p REAL NOT NULL,
  max_tokens INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_chunks_scene ON chunks(scene_id, sequence_number);
CREATE INDEX idx_audit_scene ON audit_flags(scene_id, severity);
CREATE INDEX idx_audit_category ON audit_flags(category, was_actionable);
CREATE INDEX idx_bibles_project ON bibles(project_id, version);
CREATE INDEX idx_logs_chunk ON compilation_logs(chunk_id);
```

---

## 8. Key Technical Decisions Log

| Decision | Choice | Rationale | Revisit if... |
|----------|--------|-----------|---------------|
| Epistemic tracking | Delta-based, not cumulative | O(N) per scene vs O(N²). Compiler replays deltas when needed. | Replay becomes expensive at >50 scenes |
| IR extraction timing | Async/batched (Phase 2) | Blocks drafting flow if synchronous. Human moves to next chunk while IR compiles. | Latency drops below 5s |
| Bible storage | Full JSON per version | Simple, queryable, diffable. No ORM complexity. | Bible exceeds 1MB |
| Context compilation | Pure function, no side effects | Testable, reproducible. Same inputs → same payload. | Need caching layer |
| Prompt assembly | Raw string construction | Full control over every token. No framework abstractions. | Team grows beyond 2 people |
| Negative exemplars | Short snippets + structural bans | Long negatives prime the model toward the banned patterns. | Research proves otherwise |
| Continuity bridge | 200 tokens verbatim + state bullets | Prevents rhythm break without mediocrity drag. | Voice breaks at chunk boundaries |
| Audit trust | Track signal-to-noise per category | Demote noisy categories before they train humans to ignore audits. | All categories maintain >70% |
| Revision learner | Phase 3 (manual updates until then) | Human updating bible is sufficient for MVP. Learner is optimization, not core. | Edit volume exceeds manual capacity |
| Desktop app | Tauri (Rust + web frontend) | Lighter than Electron, native performance, local-first. | Web deployment needed |

---

## 9. Success Metrics by Phase

### Phase 0 (Single Scene)
- [ ] Kill list: 0 violations in final accepted text
- [ ] Sentence variance: > 3.0 std dev
- [ ] Compiler view: user can diagnose a quality problem by reading the payload
- [ ] Bootstrap: synopsis → editable bible in < 60 seconds
- [ ] A/B test: compiled prose vs generic prompt, blind evaluation by 3 readers

### Phase 1 (One Chapter)
- [ ] Voice holds across 4+ scenes (blind evaluation)
- [ ] No tone whiplash at chunk/scene boundaries
- [ ] Audit signal-to-noise: > 60% of flags acted on
- [ ] Bible stays under Ring 1 hard cap for entire chapter
- [ ] Workflow time: faster than equivalent manual process

### Phase 2 (Short Novella)
- [ ] Cross-chapter epistemic leaks: caught by auditor in > 80% of cases
- [ ] Setup/payoff: 0 dangling setups at manuscript completion
- [ ] Voice separability: measurably distinct across characters at chapter 8
- [ ] Style drift: < 10% deviation from chapter 1 baseline at chapter 8
- [ ] Ring 1 growth: < 20% increase from initial size

### Phase 3 (Revision Learner)
- [ ] > 50% of proposed bible updates accepted by human
- [ ] Edit volume decreases per chapter (system is learning)
- [ ] Compilation profile adjustments improve audit pass rates
