import Anthropic from "@anthropic-ai/sdk";
import {
  createEmptyBible,
  createEmptyScenePlan,
  createEmptyChapterArc,
  createDefaultCompilationConfig,
  generateId,
  type Bible,
  type ScenePlan,
  type ChapterArc,
} from "../src/types/index.js";
import { computeMetrics } from "../src/auditor/index.js";
import { runChapterWorkflow, type GenerateFn } from "./driver.js";
import {
  runAllDeterministicChecks,
  type DeterministicCheckInputs,
} from "./checks/deterministic.js";
import {
  evaluateVoice,
  evaluateSceneGoal,
  evaluateToneWhiplash,
  evaluateContinuity,
  evaluateSubtext,
  evaluateMetaphoricRegister,
} from "./checks/judge.js";
import { saveArtifact } from "./artifacts.js";
import { generateReport } from "./report.js";
import type {
  EvalRunArtifact,
  CheckResult,
  JudgeScore,
  RunnerOptions,
  EvalCost,
} from "./types.js";

// ─── Default Fixtures ───────────────────────────────────

function defaultBible(): Bible {
  return {
    ...createEmptyBible("eval-project"),
    characters: [
      {
        id: "marcus",
        name: "Marcus",
        role: "protagonist",
        physicalDescription: "Tall, angular, perpetually rumpled suit",
        backstory: "Former journalist turned schoolteacher",
        selfNarrative: "He tells himself he chose teaching.",
        contradictions: ["Claims not to care; shows up every day"],
        voice: {
          sentenceLengthRange: [4, 18],
          vocabularyNotes: "Precise but informal. Newspaper diction.",
          verbalTics: ["Look,", "The thing is"],
          metaphoricRegister: "Mechanical — gears, engines, pressure",
          prohibitedLanguage: ["literally", "actually"],
          dialogueSamples: [
            "Look, I'm not saying it's a conspiracy. I'm saying someone moved the letters.",
          ],
        },
        behavior: {
          stressResponse: "Gets very still, then paces",
          socialPosture: "Deflects with questions",
          noticesFirst: "Exits and inconsistencies",
          lyingStyle: "Omission, not fabrication",
          emotionPhysicality: "Jaw tension, hand in pocket",
        },
      },
    ],
    locations: [
      {
        id: "loc-school",
        name: "Northfield School",
        description: "A crumbling red-brick school",
        sensoryPalette: {
          sounds: ["chalk on board", "distant radiator clang"],
          smells: ["floor wax", "old paper"],
          textures: ["cold metal door handles"],
          lightQuality: "Fluorescent flicker",
          atmosphere: "Institutional decay",
          prohibitedDefaults: ["sunlight streaming"],
        },
      },
    ],
    styleGuide: {
      ...createEmptyBible("eval-project").styleGuide,
      killList: [
        { pattern: "suddenly", type: "exact" },
        { pattern: "he realized", type: "exact" },
      ],
    },
    narrativeRules: {
      pov: { default: "close-third", distance: "close", interiority: "filtered", reliability: "reliable" },
      subtextPolicy: "Characters never state their actual feelings directly",
      expositionPolicy: "Embed in action or dialogue",
      sceneEndingPolicy: "End on a question or unresolved tension",
      setups: [],
    },
  };
}

function defaultScenePlans(): ScenePlan[] {
  const base = {
    ...createEmptyScenePlan("eval-project"),
    chapterId: "ch1",
    povCharacterId: "marcus",
    estimatedWordCount: [400, 600] as [number, number],
    chunkCount: 3,
    locationId: "loc-school",
  };

  return [
    { ...base, id: "scene-1", title: "The Empty Desk", narrativeGoal: "Establish the mystery", emotionalBeat: "Unease", readerEffect: "Something is wrong", failureModeToAvoid: "Stating emotions directly" },
    { ...base, id: "scene-2", title: "The Staff Room", narrativeGoal: "Deepen suspicion", emotionalBeat: "Growing paranoia", readerEffect: "Distrust the official story", failureModeToAvoid: "Info-dump through dialogue" },
    { ...base, id: "scene-3", title: "After Hours", narrativeGoal: "Discovery", emotionalBeat: "Dread", readerEffect: "Feel physical tension", failureModeToAvoid: "Melodrama" },
    { ...base, id: "scene-4", title: "The Corridor", narrativeGoal: "Confrontation without resolution", emotionalBeat: "Controlled fury", readerEffect: "Feel the weight of what's unsaid", failureModeToAvoid: "Climactic resolution too early" },
  ];
}

function defaultChapterArc(): ChapterArc {
  return {
    ...createEmptyChapterArc("eval-project", 1),
    workingTitle: "The Letters",
    narrativeFunction: "Establish the central mystery",
    dominantRegister: "literary realism with thriller undertones",
    pacingTarget: "slow build to dread",
    endingPosture: "question mark — no resolution",
  };
}

// ─── Mock LLM ───────────────────────────────────────────

const MOCK_PROSE = [
  `Marcus counted the tiles in the hallway. Seven cracked, four missing, one replaced with something that didn't quite match. The substitute teacher's desk sat empty — not cleared, exactly, but emptied. Two different things. He pulled at his collar.\n\n"Look," he said to no one in particular, "someone moved the filing cabinet." The janitor's cart stood where it always stood, but the wheels pointed wrong. Whoever had been here last hadn't been cleaning.`,

  `The staff room smelled like burnt coffee and old paper. Elena sat in the corner, thermos between her hands like a life preserver. She didn't look up when Marcus entered.\n\n"The substitute," he started. Elena's thumb traced the rim of her thermos. "What about her?" she said. The question had edges. Marcus pulled a chair and sat without asking. The fluorescent light above them buzzed — one tube going, the other already gone.`,

  `The classroom after dark felt like the inside of a held breath. Marcus ran his hand along the desk's underside and found what shouldn't have been there — an envelope, taped flat. His fingers went still.\n\nThe radiator clanged somewhere deep in the building. He peeled the envelope free, turned it over. No name. No postmark. Just the school's address, typed on a machine that pressed the letters too deep.`,

  `Elena stood at the end of the corridor, arms crossed, thermos nowhere in sight. First time for that.\n\n"You found it," she said. Not a question. Marcus held the envelope at his side. The hallway stretched between them, all linoleum and shadow.\n\n"How long have you known?" His voice came out too level, like a line drawn with a ruler. She met his eyes for the first time since September.\n\n"Since before you started looking." The fluorescent light above her flickered, then held.`,
];

function createMockGenerateFn(): GenerateFn {
  let callCount = 0;
  return async () => {
    const text = MOCK_PROSE[callCount % MOCK_PROSE.length]!;
    callCount++;
    return text;
  };
}

// ─── Real LLM ───────────────────────────────────────────

function createRealGenerateFn(client: Anthropic, model: string): GenerateFn {
  return async (payload) => {
    const response = await client.messages.create({
      model: payload.model || model,
      max_tokens: payload.maxTokens,
      system: payload.systemMessage,
      messages: [{ role: "user", content: payload.userMessage }],
      temperature: payload.temperature,
      top_p: payload.topP,
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  };
}

// ─── Main Runner ────────────────────────────────────────

async function runEval(options: RunnerOptions): Promise<void> {
  const bible = defaultBible();
  const plans = defaultScenePlans();
  const arc = defaultChapterArc();
  const config = createDefaultCompilationConfig(options.generatorModel);

  const client = options.mock ? null : new Anthropic();

  console.log(`\n=== Word Compiler Eval ===`);
  console.log(`Rollouts: ${options.rollouts}`);
  console.log(`Mode: ${options.mock ? "MOCK" : "LIVE"}`);
  console.log(`Generator: ${options.generatorModel}`);
  console.log(`Judge: ${options.judgeModel}`);
  console.log("");

  for (let rollout = 0; rollout < options.rollouts; rollout++) {
    console.log(`--- Rollout ${rollout + 1}/${options.rollouts} ---`);

    const generateFn = options.mock
      ? createMockGenerateFn()
      : createRealGenerateFn(client!, options.generatorModel);

    // Run the chapter workflow
    const driverResult = await runChapterWorkflow(bible, arc, plans, {
      generateFn,
      config,
      onSceneComplete: (sceneId, idx) => {
        console.log(`  Scene ${idx + 1}/4 complete: ${sceneId}`);
      },
    });

    // Run deterministic checks per scene
    const allDetChecks: CheckResult[] = [];
    for (let i = 0; i < driverResult.scenes.length; i++) {
      const scene = driverResult.scenes[i]!;
      const plan = plans[i]!;
      const sceneProse = scene.chunks.map((c) => c.generatedText).join("\n\n");
      const character = bible.characters.find((c) => c.id === plan.povCharacterId);
      const metrics = computeMetrics(sceneProse);

      const inputs: DeterministicCheckInputs = {
        prose: sceneProse,
        sceneId: scene.sceneId,
        bible,
        plan,
        character,
        log: scene.compilationLog,
        lintResult: scene.lintResult,
        config,
        metrics,
      };

      allDetChecks.push(...runAllDeterministicChecks(inputs));
    }

    // Run judge evaluations (skip in mock mode)
    const judgeScores: JudgeScore[] = [];
    if (!options.mock && client) {
      console.log("  Running judge evaluations...");

      for (let i = 0; i < driverResult.scenes.length; i++) {
        const scene = driverResult.scenes[i]!;
        const plan = plans[i]!;
        const sceneProse = scene.chunks.map((c) => c.generatedText).join("\n\n");
        const character = bible.characters.find((c) => c.id === plan.povCharacterId);

        // Voice consistency
        if (character) {
          const voice = await evaluateVoice(sceneProse, character, client, options.judgeModel);
          judgeScores.push(voice);
        }

        // Scene goal
        const goal = await evaluateSceneGoal(sceneProse, plan, client, options.judgeModel);
        judgeScores.push(goal);

        // Subtext
        const subtext = await evaluateSubtext(sceneProse, plan, client, options.judgeModel);
        if (subtext) judgeScores.push(subtext);

        // Metaphoric register
        const metaphor = await evaluateMetaphoricRegister(sceneProse, bible, client, options.judgeModel);
        if (metaphor) judgeScores.push(metaphor);

        // Cross-scene checks (tone whiplash + continuity)
        if (i > 0) {
          const prevScene = driverResult.scenes[i - 1]!;
          const prevEnd = prevScene.chunks[prevScene.chunks.length - 1]!.generatedText;
          const currStart = scene.chunks[0]!.generatedText;

          const tone = await evaluateToneWhiplash(prevEnd, currStart, client, options.judgeModel);
          judgeScores.push(tone);

          const cont = await evaluateContinuity(prevEnd, currStart, client, options.judgeModel);
          judgeScores.push(cont);
        }
      }
    }

    // Compute aggregates
    const voiceScores = judgeScores.filter((s) => s.dimension === "voice_consistency");
    const voiceAvg = voiceScores.length > 0
      ? voiceScores.reduce((sum, s) => sum + s.score, 0) / voiceScores.length
      : 0;

    const contScores = judgeScores.filter((s) => s.dimension === "continuity");
    const contAvg = contScores.length > 0
      ? contScores.reduce((sum, s) => sum + s.score, 0) / contScores.length
      : 0;

    const detAllPass = allDetChecks.every((c) => c.passed);
    const judgeAllPass = judgeScores.length === 0 || judgeScores.every((s) => s.passed);
    const overallPass = detAllPass && judgeAllPass;

    // Build artifact
    const artifact: EvalRunArtifact = {
      runId: generateId(),
      timestamp: new Date().toISOString(),
      bibleVersion: bible.version,
      scenePlanIds: plans.map((p) => p.id),
      chapterArcId: arc.id,
      generatorModel: options.generatorModel,
      judgeModel: options.judgeModel,
      config,
      scenes: driverResult.scenes,
      deterministicChecks: allDetChecks,
      judgeScores,
      overallPass,
      voiceConsistencyScore: voiceAvg,
      continuityScore: contAvg,
      cost: { generatorInputTokens: 0, generatorOutputTokens: 0, judgeInputTokens: 0, judgeOutputTokens: 0 },
    };

    // Save and report
    const artifactPath = saveArtifact(artifact, options.artifactDir);
    const report = generateReport(artifact);

    console.log(`\n${report.summary}`);
    console.log(`  Artifact saved: ${artifactPath}`);

    if (report.failures.length > 0) {
      console.log(`  Failures:`);
      for (const f of report.failures) {
        console.log(`    - ${f}`);
      }
    }
    console.log("");
  }
}

// ─── CLI Entry Point ────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1]! : defaultValue;
}

const options: RunnerOptions = {
  rollouts: parseInt(getArg("rollouts", "1"), 10),
  mock: args.includes("--mock"),
  generatorModel: getArg("generator", "claude-sonnet-4-6"),
  judgeModel: getArg("judge", "claude-sonnet-4-6"),
  artifactDir: getArg("artifact-dir", new URL("./runs", import.meta.url).pathname),
};

runEval(options).catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
