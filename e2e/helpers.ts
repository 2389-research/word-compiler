import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const PROJECT_ID = "proj-e2e-test";

const MOCK_PROJECT = {
  id: PROJECT_ID,
  title: "E2E Test Project",
  status: "drafting",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

export const MOCK_BIBLE = {
  projectId: PROJECT_ID,
  version: 1,
  characters: [
    {
      id: "marcus",
      name: "Marcus",
      role: "protagonist",
      physicalDescription: "Weathered hands",
      backstory: "Former boxer",
      selfNarrative: null,
      contradictions: null,
      voice: {
        sentenceLengthRange: [6, 14],
        vocabularyNotes: "Blue-collar precise",
        verbalTics: [],
        metaphoricRegister: "machinery",
        prohibitedLanguage: [],
        dialogueSamples: [],
      },
      behavior: {
        stressResponse: "Goes still",
        socialPosture: "Edge of conversations",
        noticesFirst: "Hands",
        lyingStyle: "Omits",
        emotionPhysicality: "Jaw tightens",
      },
    },
  ],
  locations: [],
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
    pov: { default: "close-third", distance: "close", interiority: "filtered", reliability: "reliable" },
    subtextPolicy: null,
    expositionPolicy: null,
    sceneEndingPolicy: null,
    setups: [],
  },
  createdAt: "2025-01-01T00:00:00Z",
  sourcePrompt: null,
};

interface StartupOptions {
  /** If provided, the bible endpoint returns this instead of 404. */
  bible?: object;
}

/**
 * Mocks the startup API calls so the app boots into the main UI
 * with a single empty project. Pass `bible` option to pre-load a bible.
 * Call BEFORE page.goto("/").
 */
export async function mockStartup(page: Page, options: StartupOptions = {}) {
  // List projects → single project
  await page.route("**/api/data/projects", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_PROJECT]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
  });

  // Get project by ID (any project)
  await page.route(/\/api\/data\/projects\/[^/]+$/, (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
    }
    return route.continue();
  });

  // Latest bible → configurable
  await page.route("**/bibles/latest", (route) => {
    if (options.bible) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.bible) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No bible" }) });
  });

  // Bible versions → empty
  await page.route("**/bibles/versions", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Chapter arcs → empty
  await page.route("**/chapters", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
  });

  // POST bibles → echo back the body (any project)
  await page.route(/\/api\/data\/projects\/[^/]+\/bibles$/, (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // POST scenes → return just the plan
  await page.route("**/api/data/scenes", (route, request) => {
    if (request.method() === "POST") {
      try {
        const body = JSON.parse(request.postData() ?? "{}");
        const plan = body.plan ?? body;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plan) });
      } catch {
        return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
      }
    }
    return route.continue();
  });
}

/**
 * Like mockStartup, but pre-loads a bible with 1 character.
 * This unlocks the Plan stage.
 */
export async function mockStartupWithBible(page: Page) {
  await mockStartup(page, { bible: MOCK_BIBLE });
}

// ─── Shared Scene Setup ───────────────────────────

interface SceneSetupOptions {
  /** Kill list entries for the bible. */
  killList?: Array<{ pattern: string; type: string }>;
  /** Scene title. */
  sceneTitle?: string;
  /** Chunk text content. */
  chunkText: string;
  /** Chunk status (e.g. "pending", "accepted"). */
  chunkStatus?: string;
  /** Scene status (e.g. "drafting", "complete"). */
  sceneStatus?: string;
  /** Whether to add audit-flag/stats/edit-patterns routes (needed for Edit stage). */
  includeAuditRoutes?: boolean;
}

/**
 * Shared helper: sets up a project with a bible, one chapter, one scene, and
 * one chunk. Blocks the LLM proxy. Builds on mockStartup to avoid duplicating
 * base route setup. Call BEFORE page.goto("/").
 */
async function mockStartupWithScene(page: Page, options: SceneSetupOptions) {
  const CHAPTER_ID = "ch-e2e-scene";
  const SCENE_ID = "scene-e2e-scene";
  const CHUNK_ID = "chunk-e2e-scene";

  const bible = {
    ...MOCK_BIBLE,
    styleGuide: {
      ...MOCK_BIBLE.styleGuide,
      killList: options.killList ?? [],
    },
  };

  const chapter = {
    id: CHAPTER_ID,
    projectId: PROJECT_ID,
    chapterNumber: 1,
    workingTitle: "Test Chapter",
    narrativeFunction: "Test",
    dominantRegister: "neutral",
    pacingTarget: "moderate",
    endingPosture: "resolved",
    readerStateEntering: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    readerStateExiting: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    sourcePrompt: null,
  };

  const scenePlan = {
    id: SCENE_ID,
    projectId: PROJECT_ID,
    chapterId: CHAPTER_ID,
    title: options.sceneTitle ?? "Test Scene",
    povCharacterId: "marcus",
    povDistance: "close",
    narrativeGoal: "Test",
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
    estimatedWordCount: [400, 600],
    chunkCount: 1,
    chunkDescriptions: ["A test chunk"],
    failureModeToAvoid: "",
    locationId: null,
    presentCharacterIds: ["marcus"],
  };

  const chunk = {
    id: CHUNK_ID,
    sceneId: SCENE_ID,
    sequenceNumber: 0,
    generatedText: options.chunkText,
    editedText: null,
    humanNotes: null,
    status: options.chunkStatus ?? "pending",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "test-hash",
    generatedAt: "2025-01-01T00:00:00Z",
  };

  // Catch-all fallbacks (LIFO — registered first, checked last)
  await page.route("**/api/data/chunks/**", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/data/scenes/**", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Block LLM proxy
  await page.route("**/api/generate**", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: JSON.stringify({ annotations: [] }),
        usage: { input_tokens: 100, output_tokens: 50 },
        stopReason: "end_turn",
      }),
    });
  });

  // Base startup with bible
  await mockStartup(page, { bible });

  // Override chapters to return one chapter
  await page.unroute("**/chapters");
  await page.route("**/projects/*/chapters", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([chapter]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
  });

  // Specific routes (registered LAST = checked FIRST by Playwright)
  await page.route(`**/chapters/${CHAPTER_ID}/scenes`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ plan: scenePlan, status: options.sceneStatus ?? "drafting", sceneOrder: 0 }]),
    });
  });

  await page.route(`**/chapters/${CHAPTER_ID}/irs`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route(`**/scenes/${SCENE_ID}/chunks`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([chunk]) });
  });

  // Audit/edit routes (needed for stages beyond Draft)
  if (options.includeAuditRoutes) {
    await page.route(`**/scenes/${SCENE_ID}/audit-flags`, (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route(`**/scenes/${SCENE_ID}/audit-stats`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total: 0, resolved: 0, actionable: 0 }),
      });
    });
    await page.route(`**/scenes/${SCENE_ID}/edit-patterns`, (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
  }
}

/**
 * Mocks startup at the Draft stage with kill list violations in the chunk text.
 * Only deterministic local checks produce annotations (LLM is blocked).
 * Call BEFORE page.goto("/").
 */
export async function mockStartupAtDraft(page: Page) {
  await mockStartupWithScene(page, {
    killList: [
      { pattern: "very", type: "exact" },
      { pattern: "suddenly", type: "exact" },
    ],
    sceneTitle: "Draft Test Scene",
    chunkText:
      "Marcus was very tired after the long day. He suddenly realized the door was open. The night was very quiet and very still.",
    chunkStatus: "pending",
  });
}

/**
 * Mocks startup at the Edit stage with an accepted chunk and empty audit flags
 * (Audit→Edit gate passes). Call BEFORE page.goto("/").
 */
export async function mockStartupAtEdit(page: Page) {
  await mockStartupWithScene(page, {
    killList: [{ pattern: "very", type: "exact" }],
    sceneTitle: "The Quiet Bar",
    chunkText: "Marcus sat at the bar and stared at his hands. The ice shifted in his glass. Nobody spoke.",
    chunkStatus: "accepted",
    includeAuditRoutes: true,
  });
}

/** Navigate to a workflow stage via the WorkflowRail stepper. */
export async function navigateToStage(page: Page, stageLabel: string) {
  const stageBtn = page.locator('[aria-label="Progress"] button', { hasText: stageLabel });
  await expect(stageBtn).toBeVisible();
  await stageBtn.click();
}
