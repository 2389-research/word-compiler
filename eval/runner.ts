import Anthropic from "@anthropic-ai/sdk";
import { computeMetrics } from "../src/auditor/index.js";
import {
  type Bible,
  type ChapterArc,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyChapterArc,
  createEmptyScenePlan,
  generateId,
  type ScenePlan,
} from "../src/types/index.js";
import { saveArtifact } from "./artifacts.js";
import { type DeterministicCheckInputs, runAllDeterministicChecks } from "./checks/deterministic.js";
import {
  evaluateContinuity,
  evaluateMetaphoricRegister,
  evaluateSceneGoal,
  evaluateSubtext,
  evaluateToneWhiplash,
  evaluateVoice,
} from "./checks/judge.js";
import { type GenerateFn, runChapterWorkflow } from "./driver.js";
import { generateReport } from "./report.js";
import type { CheckResult, EvalRunArtifact, JudgeScore, RunnerOptions } from "./types.js";

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
          dialogueSamples: ["Look, I'm not saying it's a conspiracy. I'm saying someone moved the letters."],
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
    {
      ...base,
      id: "scene-1",
      title: "The Empty Desk",
      narrativeGoal: "Establish the mystery",
      emotionalBeat: "Unease",
      readerEffect: "Something is wrong",
      failureModeToAvoid: "Stating emotions directly",
    },
    {
      ...base,
      id: "scene-2",
      title: "The Staff Room",
      narrativeGoal: "Deepen suspicion",
      emotionalBeat: "Growing paranoia",
      readerEffect: "Distrust the official story",
      failureModeToAvoid: "Info-dump through dialogue",
    },
    {
      ...base,
      id: "scene-3",
      title: "After Hours",
      narrativeGoal: "Discovery",
      emotionalBeat: "Dread",
      readerEffect: "Feel physical tension",
      failureModeToAvoid: "Melodrama",
    },
    {
      ...base,
      id: "scene-4",
      title: "The Corridor",
      narrativeGoal: "Confrontation without resolution",
      emotionalBeat: "Controlled fury",
      readerEffect: "Feel the weight of what's unsaid",
      failureModeToAvoid: "Climactic resolution too early",
    },
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
  `Marcus counted the tiles in the hallway. Seven cracked, four missing, one replaced with something that didn't quite match the originals — close, but wrong in the way a forged document is wrong. The substitute teacher's desk sat empty. Not cleared, exactly, but emptied. Two different things. He pulled at his collar and stood there a moment longer than was necessary.

"Look," he said to no one in particular, "someone moved the filing cabinet." The janitor's cart stood where it always stood, but the wheels pointed wrong. Whoever had been here last hadn't been cleaning. The chalk tray had been wiped down, but the eraser left behind carried a clean edge, not the worn-down radius of daily use. A replacement eraser, then. Someone had brought their own.

He crossed to the window. The latch was seated but not locked — a gap of maybe two millimeters between the frame and the sill, the kind of thing you'd miss if you weren't the sort of person who checked. Marcus was exactly that sort of person. He pressed it closed and heard the click it should have made hours ago.`,

  `The staff room smelled like burnt coffee and old paper, a combination Marcus associated with pressure systems building before a storm. Elena sat in the corner, thermos between her hands like a life preserver she wasn't sure she believed in. She didn't look up when he entered.

"The substitute," he started. Elena's thumb traced the rim of her thermos in a slow circuit. "What about her?" she said. The question had edges on it — not sharp, exactly, but present.

Marcus pulled a chair and sat without asking. The fluorescent light above them buzzed, one tube going, the other already gone. Half the room in clean light, half in something thinner. He waited. Elena was a person who filled silence eventually. Most people were.

"She came recommended," Elena said finally. Her thumb stopped. "By someone I trusted at the time." The past tense was doing a lot of work in that sentence, and she knew he'd noticed. She looked up.`,

  `The classroom after dark felt like the inside of a held breath. Marcus moved without the overhead light — the hallway fluorescents gave enough through the door's wire-glass panel, narrow and yellow, the kind of light that shows shapes but not detail. He ran his hand along the underside of the desk's top drawer and found what shouldn't have been there: an envelope, taped flat against the wood with two strips of packing tape, the kind with the thread reinforcement running through it.

His fingers went still. The radiator clanged somewhere deep in the building, metal contracting against metal, the thermal ratchet that kept the place running at a deficit. He peeled the envelope free — the tape released cleanly, no damage to the paper, which meant it had been placed by someone who expected it to be retrieved. He turned it over. No name. No postmark. Just the school's address, typed on a machine that pressed the letters too deep into the paper, the way old typewriters did when the ribbon was worn thin.`,

  `Elena stood at the end of the corridor, arms crossed, thermos nowhere in sight. First time for that. Without it she looked different — not smaller, exactly, but less defended, like a boiler without its housing.

"You found it," she said. Not a question. Marcus held the envelope at his side, his thumb against the seal. The hallway stretched between them, all linoleum and shadow, the kind of distance that wasn't really about distance.

"How long have you known?" His voice came out too level. A line drawn with a ruler — technically straight, no warmth in the tool that made it. She heard it. He watched her hear it.

"Since before you started looking." She didn't move. "Since before I put it there." The fluorescent light above her flickered twice, then held. Marcus felt the machinery of the last three weeks engage differently, gears clicking into positions he should have mapped earlier, the whole mechanism a thing he'd been reading backward.

He said nothing. The envelope was light in his hand. She waited for him to ask the next question, and he was already deciding whether to ask it.`,
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
  let anyRolloutFailed = false;
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

    const generateFn = options.mock ? createMockGenerateFn() : createRealGenerateFn(client!, options.generatorModel);

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
    const voiceAvg = voiceScores.length > 0 ? voiceScores.reduce((sum, s) => sum + s.score, 0) / voiceScores.length : 0;

    const contScores = judgeScores.filter((s) => s.dimension === "continuity");
    const contAvg = contScores.length > 0 ? contScores.reduce((sum, s) => sum + s.score, 0) / contScores.length : 0;

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
      anyRolloutFailed = true;
      console.log(`  Failures:`);
      for (const f of report.failures) {
        console.log(`    - ${f}`);
      }
    }
    console.log("");
  }

  if (anyRolloutFailed) {
    process.exit(1);
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
