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

/**
 * Mocks startup with a bible (including kill list), a chapter, a "drafting" scene,
 * and a chunk whose text contains kill list violations. Blocks the LLM route
 * so only deterministic local checks produce annotations.
 * Call BEFORE page.goto("/").
 */
export async function mockStartupAtDraft(page: Page) {
  const CHAPTER_ID = "ch-e2e-test";
  const SCENE_ID = "scene-e2e-draft";
  const CHUNK_ID = "chunk-e2e-test";

  const bibleWithKillList = {
    ...MOCK_BIBLE,
    styleGuide: {
      ...MOCK_BIBLE.styleGuide,
      killList: [
        { pattern: "very", type: "exact" },
        { pattern: "suddenly", type: "exact" },
      ],
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
    title: "Draft Test Scene",
    povCharacterId: "marcus",
    povDistance: "close",
    narrativeGoal: "Test editorial review",
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
    generatedText:
      "Marcus was very tired after the long day. He suddenly realized the door was open. The night was very quiet and very still.",
    editedText: null,
    humanNotes: null,
    status: "pending",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "test-hash",
    generatedAt: "2025-01-01T00:00:00Z",
  };

  // Playwright routes use LIFO: last registered = first checked.
  // Register catch-all/fallback routes FIRST, specific routes LAST.

  // Catch-all fallbacks (checked last by Playwright)
  await page.route("**/api/data/chunks/**", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/api/data/scenes/**", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Block LLM proxy — /api/generate returns { text, usage, stopReason }
  // where text is the JSON string the LLM would produce
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

  // Standard startup routes
  await page.route("**/api/data/projects", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_PROJECT]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
  });

  await page.route(/\/api\/data\/projects\/[^/]+$/, (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
    }
    return route.continue();
  });

  await page.route(/\/api\/data\/projects\/[^/]+\/bibles$/, (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route("**/bibles/latest", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(bibleWithKillList),
    });
  });

  await page.route("**/bibles/versions", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Chapter arcs → 1 chapter
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
      body: JSON.stringify([{ plan: scenePlan, status: "drafting", sceneOrder: 0 }]),
    });
  });

  await page.route(`**/chapters/${CHAPTER_ID}/irs`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route(`**/scenes/${SCENE_ID}/chunks`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([chunk]) });
  });
}

/** Navigate to a workflow stage via the WorkflowRail stepper. */
export async function navigateToStage(page: Page, stageLabel: string) {
  const stageBtn = page.locator('[aria-label="Progress"] button', { hasText: stageLabel });
  await expect(stageBtn).toBeVisible();
  await stageBtn.click();
}
