import { runAudit } from "../../auditor/index.js";
import { reconcileSetupStatuses } from "../../auditor/setupReconciler.js";
import { checkSubtext } from "../../auditor/subtext.js";
import { extractIR, type IRLLMClient } from "../../ir/extractor.js";
import { callLLM, generateStream } from "../../llm/client.js";
import { buildReviewContext } from "../../review/contextBuilder.js";
import {
  buildContinuousText,
  buildRefinementSystemPrompt,
  buildRefinementUserPrompt,
  parseRefinementResponse,
  REFINEMENT_OUTPUT_SCHEMA,
} from "../../review/refine.js";
import type { RefinementRequest, RefinementResult } from "../../review/refineTypes.js";
import type { Chunk, NarrativeIR } from "../../types/index.js";
import { generateId, getCanonicalText } from "../../types/index.js";
import type { Commands } from "./commands.js";
import type { ProjectStore } from "./project.svelte.js";

export function createGenerationActions(store: ProjectStore, commands: Commands) {
  /** Helper: get chunks for a specific scene (avoids activeSceneIndex dependency) */
  function chunksForScene(sceneId: string): Chunk[] {
    return store.sceneChunks[sceneId] ?? [];
  }

  /** Helper: guard against empty generation, returns true if generation was empty */
  function handleEmptyGeneration(fullText: string, stopReason: string, sceneId: string, chunkIndex: number): boolean {
    if (fullText.trim()) return false;
    const reason =
      stopReason === "max_tokens"
        ? "The model used all output tokens without producing text. Try increasing the output token budget in your generation config."
        : "Generation produced no text. Check server logs for details.";
    store.setError(`Empty generation: ${reason}`);
    store.removeChunkForScene(sceneId, chunkIndex);
    return true;
  }

  /** Helper: persist finalized chunk and run + save audit */
  async function persistChunkAndAudit(sceneId: string, chunkIndex: number, pendingChunk: Chunk, fullText: string) {
    const finalChunk = chunksForScene(sceneId)[chunkIndex];
    if (finalChunk) await commands.saveChunk(finalChunk);

    const allText = [...chunksForScene(sceneId).slice(0, chunkIndex), { ...pendingChunk, generatedText: fullText }]
      .map((c) => getCanonicalText(c))
      .join("\n\n");
    const { flags, metrics } = runAudit(allText, store.bible!, sceneId);
    store.setAudit(flags, metrics);

    await commands.saveAuditFlags(flags);
  }

  async function generateChunk(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!store.compiledPayload || !store.bible || !plan) {
      store.setError("Cannot generate: missing compiled payload, bible, or scene plan");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;

    store.setGenerating(true);
    store.setError(null);

    try {
      const chunkId = generateId();
      const chunkIndex = chunksForScene(sceneId).length;
      const pendingChunk: Chunk = {
        id: chunkId,
        sceneId,
        sequenceNumber: chunkIndex,
        generatedText: "",
        payloadHash: generateId(),
        model: store.compiledPayload.model,
        temperature: store.compiledPayload.temperature,
        topP: store.compiledPayload.topP,
        generatedAt: new Date().toISOString(),
        status: "pending",
        editedText: null,
        humanNotes: null,
      };
      store.addChunk(pendingChunk);

      let fullText = "";
      let streamFailed = false;
      let stopReason = "";
      await generateStream(store.compiledPayload, {
        onToken: (text) => {
          fullText += text;
          store.updateChunkForScene(sceneId, chunkIndex, { generatedText: fullText });
        },
        onDone: (usage, reason) => {
          stopReason = reason;
          console.debug("[generation] Stream done:", { stopReason: reason, usage, textLength: fullText.length });
          store.updateChunkForScene(sceneId, chunkIndex, { generatedText: fullText });
        },
        onError: (err) => {
          streamFailed = true;
          store.setError(`Generation failed: ${err}`);
        },
      });

      // Abort if stream errored — don't persist partial/invalid prose
      if (streamFailed) return;

      if (handleEmptyGeneration(fullText, stopReason, sceneId, chunkIndex)) return;

      await persistChunkAndAudit(sceneId, chunkIndex, pendingChunk, fullText);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      store.setGenerating(false);
    }
  }

  async function runAuditManual(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan) {
      store.setError("Cannot audit: missing bible or scene plan");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;
    const chunks = chunksForScene(sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot audit: no chunks for this scene");
      return;
    }

    try {
      const allText = chunks.map((c) => getCanonicalText(c)).join("\n\n");
      const { flags, metrics } = runAudit(allText, store.bible!, sceneId);
      store.setAudit(flags, metrics);
      await commands.saveAuditFlags(flags);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Manual audit failed");
    }
  }

  /** Helper: validate preconditions for IR extraction, returning context or null */
  function validateIRExtraction(
    pinnedSceneId?: string,
  ): { plan: typeof store.activeScenePlan & object; sceneId: string; prose: string } | null {
    const plan = store.activeScenePlan;
    if (!plan) {
      store.setError("Cannot extract IR: no active scene plan");
      return null;
    }
    if (!store.bible) {
      store.setError("Cannot extract IR: no bible loaded");
      return null;
    }

    const sceneId = pinnedSceneId ?? plan.id;
    const chunks = chunksForScene(sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot extract IR: no chunks for this scene");
      return null;
    }

    const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
    if (!prose.trim()) {
      store.setError("Cannot extract IR: all chunks are empty. Generate prose content first.");
      return null;
    }

    return { plan, sceneId, prose };
  }

  async function reconcileSetupsAfterIR(sceneId: string, ir: NarrativeIR): Promise<void> {
    if (!store.bible) return;
    const sceneOrders: Record<string, number> = {};
    for (const s of store.scenes) {
      sceneOrders[s.plan.id] = s.sceneOrder;
    }
    const { updatedBible, changes } = reconcileSetupStatuses(
      store.bible,
      { ...store.sceneIRs, [sceneId]: ir },
      sceneOrders,
      [sceneId],
    );
    if (changes.length > 0) {
      await commands.saveBible(updatedBible);
    }
  }

  async function extractSceneIR(pinnedSceneId?: string) {
    const validated = validateIRExtraction(pinnedSceneId);
    if (!validated) return;

    const { plan, sceneId, prose } = validated;
    const scenePlan = store.scenes.find((s) => s.plan.id === sceneId)?.plan ?? plan;

    store.setExtractingIR(sceneId);
    store.setError(null);

    try {
      const llmClient: IRLLMClient = {
        call: (systemMessage, userMessage, model, maxTokens, outputSchema) =>
          callLLM(systemMessage, userMessage, model, maxTokens, outputSchema),
      };
      const ir = await extractIR(prose, scenePlan, store.bible!, llmClient);
      await commands.saveSceneIR(sceneId, ir);
      // Reconcile Bible setup statuses against IR evidence — awaited to avoid clobbering concurrent Bible edits
      try {
        await reconcileSetupsAfterIR(sceneId, ir);
      } catch (err) {
        store.setError(`Setup reconciliation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      store.setIRInspectorOpen(true);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "IR extraction failed");
    } finally {
      store.setExtractingIR(null);
    }
  }

  async function runDeepAudit(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan) {
      store.setError("Cannot run deep audit: missing bible or scene plan");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;
    const chunks = chunksForScene(sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot run deep audit: no chunks for this scene");
      return;
    }

    const scenePlan = store.scenes.find((s) => s.plan.id === sceneId)?.plan ?? plan;

    store.setError(null);
    store.setAuditing(true);

    try {
      const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
      const subtextClient = {
        call: (systemMessage: string, userMessage: string, model: string, maxTokens: number) =>
          callLLM(systemMessage, userMessage, model, maxTokens),
      };
      const subtextFlags = await checkSubtext(prose, scenePlan, subtextClient);

      if (subtextFlags.length > 0) {
        const combined = [...store.auditFlags, ...subtextFlags];
        store.setAudit(combined, store.metrics);
        await commands.saveAuditFlags(combined);
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Deep audit failed");
    } finally {
      store.setAuditing(false);
    }
  }

  /** Helper: run one iteration of the autopilot loop. Returns false to stop looping. */
  async function runAutopilotIteration(sceneId: string): Promise<boolean> {
    if (store.autopilotCancelled) return false;

    const chunkCountBefore = chunksForScene(sceneId).length;

    await generateChunk(sceneId);
    if (store.autopilotCancelled) return false;

    const chunksAfter = chunksForScene(sceneId);
    if (chunksAfter.length <= chunkCountBefore) {
      return false;
    }

    const latestChunk = chunksAfter[chunksAfter.length - 1];
    if (!latestChunk || !getCanonicalText(latestChunk).trim()) {
      store.setError("Autopilot stopped: generated chunk has no content.");
      return false;
    }

    const chunkIndex = chunksAfter.length - 1;
    await commands.updateChunk(sceneId, chunkIndex, { status: "accepted" });
    return true;
  }

  /** Helper: finalize autopilot by completing scene and extracting IR */
  async function finalizeAutopilot(sceneId: string) {
    if (store.autopilotCancelled) return;

    const result = await commands.completeScene(sceneId);
    if (!result.ok) {
      store.setError(`Autopilot finished but scene cannot be completed: ${result.error}`);
    } else {
      await extractSceneIR(sceneId);
    }
  }

  async function runAutopilot() {
    const plan = store.activeScenePlan;
    if (!plan || !store.compiledPayload || !store.bible) {
      store.setError("Cannot start autopilot: missing scene plan, compiled payload, or bible");
      return;
    }

    // Pin the scene context so switching scenes mid-autopilot can't break the loop
    const sceneId = plan.id;

    store.setAutopilot(true);
    const maxChunks = plan.chunkCount ?? 3;

    try {
      while (chunksForScene(sceneId).length < maxChunks) {
        const shouldContinue = await runAutopilotIteration(sceneId);
        if (!shouldContinue) break;
      }

      await finalizeAutopilot(sceneId);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Autopilot failed");
    } finally {
      store.setAutopilot(false);
    }
  }

  async function requestRefinement(request: RefinementRequest): Promise<RefinementResult | null> {
    if (!store.bible || !store.activeScenePlan) {
      store.setError("Cannot refine: missing bible or scene plan");
      return null;
    }

    const scenePlan = store.scenes.find((s) => s.plan.id === request.sceneId)?.plan ?? store.activeScenePlan;
    const chunks = chunksForScene(request.sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot refine: no chunks for this scene");
      return null;
    }

    const requestedAt = new Date().toISOString();
    store.setError(null);

    try {
      const context = buildReviewContext(store.bible, scenePlan);
      const systemPrompt = buildRefinementSystemPrompt(context);
      const { text: sceneText } = buildContinuousText(chunks);
      const userPrompt = buildRefinementUserPrompt(sceneText, request, scenePlan.title, scenePlan.narrativeGoal);

      const raw = await callLLM(systemPrompt, userPrompt, "claude-sonnet-4-6", 4096, REFINEMENT_OUTPUT_SCHEMA);
      const { variants, parseError } = parseRefinementResponse(raw, store.bible.styleGuide.killList);

      if (variants.length === 0) {
        store.setError(parseError ?? "Refinement produced no usable variants. Try rephrasing your instruction.");
        return null;
      }

      return {
        variants,
        requestedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Refinement failed");
      return null;
    }
  }

  return { generateChunk, runAuditManual, runDeepAudit, extractSceneIR, runAutopilot, requestRefinement };
}
