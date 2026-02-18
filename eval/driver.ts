import type {
  Bible,
  ChapterArc,
  Chunk,
  CompilationConfig,
  CompiledPayload,
  ScenePlan,
} from "../src/types/index.js";
import { generateId, getCanonicalText } from "../src/types/index.js";
import { compilePayload, type CompileResult } from "../src/compiler/assembler.js";
import { runAudit, computeMetrics } from "../src/auditor/index.js";
import type { EvalSceneResult } from "./types.js";

// ─── Generate Function Signature ────────────────────────

export type GenerateFn = (payload: CompiledPayload) => Promise<string>;

// ─── Driver Options ─────────────────────────────────────

export interface DriverOptions {
  generateFn: GenerateFn;
  config: CompilationConfig;
  onSceneComplete?: (sceneId: string, sceneIndex: number) => void;
}

// ─── Driver Result ──────────────────────────────────────

export interface DriverResult {
  scenes: EvalSceneResult[];
  allProse: string;
  allChunks: Chunk[];
}

// ─── Main Driver ────────────────────────────────────────

export async function runChapterWorkflow(
  bible: Bible,
  chapterArc: ChapterArc,
  scenePlans: ScenePlan[],
  options: DriverOptions,
): Promise<DriverResult> {
  const allScenes: EvalSceneResult[] = [];
  const allChunks: Chunk[] = [];
  let previousSceneLastChunk: Chunk | undefined;

  for (let sceneIdx = 0; sceneIdx < scenePlans.length; sceneIdx++) {
    const plan = scenePlans[sceneIdx]!;
    const sceneChunks: Chunk[] = [];

    for (let chunkNum = 0; chunkNum < plan.chunkCount; chunkNum++) {
      // Compile
      const compileResult: CompileResult = compilePayload(
        bible,
        plan,
        sceneChunks,
        chunkNum,
        options.config,
        chapterArc,
        chunkNum === 0 ? previousSceneLastChunk : undefined,
      );

      // Generate
      const generatedText = await options.generateFn(compileResult.payload);

      // Create chunk
      const chunk: Chunk = {
        id: generateId(),
        sceneId: plan.id,
        sequenceNumber: chunkNum,
        generatedText,
        payloadHash: compileResult.log.payloadHash,
        model: compileResult.payload.model,
        temperature: compileResult.payload.temperature,
        topP: compileResult.payload.topP,
        generatedAt: new Date().toISOString(),
        status: "accepted", // Auto-accept in eval mode
        editedText: null,
        humanNotes: null,
      };

      sceneChunks.push(chunk);
    }

    // Accumulate full scene prose
    const sceneProse = sceneChunks.map((c) => getCanonicalText(c)).join("\n\n");

    // Audit the scene
    const { flags, metrics } = runAudit(sceneProse, bible, plan.id);

    // Build per-chunk audit/metrics detail
    const chunkDetails = sceneChunks.map((chunk) => {
      const chunkText = getCanonicalText(chunk);
      const chunkMetrics = computeMetrics(chunkText);
      const chunkAudit = runAudit(chunkText, bible, plan.id);
      return {
        generatedText: chunk.generatedText,
        auditFlags: chunkAudit.flags,
        metrics: chunkMetrics,
      };
    });

    // Get the last compilation log for this scene (from the last chunk)
    const lastCompileResult = compilePayload(
      bible,
      plan,
      sceneChunks.slice(0, -1),
      sceneChunks.length - 1,
      options.config,
      chapterArc,
      sceneChunks.length - 1 === 0 ? previousSceneLastChunk : undefined,
    );

    allScenes.push({
      sceneId: plan.id,
      compilationLog: lastCompileResult.log,
      lintResult: lastCompileResult.lintResult,
      chunks: chunkDetails,
    });

    // Set bridge for next scene
    previousSceneLastChunk = sceneChunks[sceneChunks.length - 1];
    allChunks.push(...sceneChunks);

    options.onSceneComplete?.(plan.id, sceneIdx);
  }

  const allProse = allChunks.map((c) => getCanonicalText(c)).join("\n\n");

  return { scenes: allScenes, allProse, allChunks };
}
