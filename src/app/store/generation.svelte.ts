import { runAudit } from "../../auditor/index.js";
import { checkSubtext } from "../../auditor/subtext.js";
import { extractIR, type IRLLMClient } from "../../ir/extractor.js";
import { callLLM, generateStream } from "../../llm/client.js";
import type { Chunk } from "../../types/index.js";
import { generateId, getCanonicalText } from "../../types/index.js";
import type { ApiActions } from "./api-actions.js";
import type { ProjectStore } from "./project.svelte.js";

export function createGenerationActions(store: ProjectStore, actions?: ApiActions) {
  async function generateChunk() {
    const plan = store.activeScenePlan;
    if (!store.compiledPayload || !store.bible || !plan) return;

    store.setGenerating(true);
    store.setError(null);

    try {
      const chunkId = generateId();
      const chunkIndex = store.activeSceneChunks.length;
      const pendingChunk: Chunk = {
        id: chunkId,
        sceneId: plan.id,
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
      await generateStream(store.compiledPayload, {
        onToken: (text) => {
          fullText += text;
          store.updateChunk(chunkIndex, { generatedText: fullText });
        },
        onDone: () => {
          store.updateChunk(chunkIndex, { generatedText: fullText });
        },
        onError: (err) => {
          store.setError(`Generation failed: ${err}`);
        },
      });

      // Persist the finalized chunk
      const finalChunk = store.activeSceneChunks[chunkIndex];
      if (finalChunk && actions) await actions.saveChunk(finalChunk);

      // Run audit on all chunks for this scene
      const allText = [...store.activeSceneChunks.slice(0, chunkIndex), { ...pendingChunk, generatedText: fullText }]
        .map((c) => getCanonicalText(c))
        .join("\n\n");
      const { flags, metrics } = runAudit(allText, store.bible, plan.id);
      store.setAudit(flags, metrics);

      // Persist audit flags
      if (actions) await actions.saveAuditFlags(flags);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      store.setGenerating(false);
    }
  }

  function runAuditManual() {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan || store.activeSceneChunks.length === 0) return;

    const allText = store.activeSceneChunks.map((c) => getCanonicalText(c)).join("\n\n");
    const { flags, metrics } = runAudit(allText, store.bible, plan.id);
    store.setAudit(flags, metrics);
  }

  async function extractSceneIR() {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan || store.activeSceneChunks.length === 0) return;

    store.setExtractingIR(plan.id);
    store.setError(null);

    try {
      const prose = store.activeSceneChunks.map((c) => getCanonicalText(c)).join("\n\n");
      const llmClient: IRLLMClient = {
        call: (systemMessage, userMessage, model, maxTokens, outputSchema) =>
          callLLM(systemMessage, userMessage, model, maxTokens, outputSchema),
      };
      const ir = await extractIR(prose, plan, store.bible, llmClient);
      if (actions) {
        await actions.saveSceneIR(plan.id, ir);
      } else {
        store.setSceneIR(plan.id, ir);
      }
      store.setIRInspectorOpen(true);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "IR extraction failed");
    } finally {
      store.setExtractingIR(null);
    }
  }

  async function runDeepAudit() {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan || store.activeSceneChunks.length === 0) return;

    store.setError(null);

    try {
      const prose = store.activeSceneChunks.map((c) => getCanonicalText(c)).join("\n\n");
      const subtextClient = {
        call: (systemMessage: string, userMessage: string, model: string, maxTokens: number) =>
          callLLM(systemMessage, userMessage, model, maxTokens),
      };
      const subtextFlags = await checkSubtext(prose, plan, subtextClient);

      if (subtextFlags.length > 0) {
        // Append subtext flags to existing audit flags
        const combined = [...store.auditFlags, ...subtextFlags];
        store.setAudit(combined, store.metrics);
        if (actions) await actions.saveAuditFlags(combined);
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Deep audit failed");
    }
  }

  async function runAutopilot(completeScene: () => Promise<void>) {
    const plan = store.activeScenePlan;
    if (!plan || !store.compiledPayload || !store.bible) return;

    store.setAutopilot(true);
    const maxChunks = plan.chunkCount ?? 3;

    try {
      while (store.activeSceneChunks.length < maxChunks) {
        if (store.autopilotCancelled) break;

        // Generate next chunk
        await generateChunk();
        if (store.autopilotCancelled) break;

        // Auto-accept the chunk we just generated
        const chunkIndex = store.activeSceneChunks.length - 1;
        store.updateChunk(chunkIndex, { status: "accepted" });
        const accepted = store.activeSceneChunks[chunkIndex];
        if (accepted && actions) await actions.updateChunk(accepted);
      }

      if (!store.autopilotCancelled) {
        // Complete scene (which also triggers blueprint extraction)
        await completeScene();
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Autopilot failed");
    } finally {
      store.setAutopilot(false);
    }
  }

  return { generateChunk, runAuditManual, runDeepAudit, extractSceneIR, runAutopilot };
}
