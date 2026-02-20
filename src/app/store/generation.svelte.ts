import { runAudit } from "../../auditor/index.js";
import { extractIR, type IRLLMClient } from "../../ir/extractor.js";
import { callLLM, generateStream } from "../../llm/client.js";
import type { Chunk } from "../../types/index.js";
import { generateId, getCanonicalText } from "../../types/index.js";
import type { ProjectStore } from "./project.svelte.js";

export function createGenerationActions(store: ProjectStore) {
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

      // Run audit on all chunks for this scene
      const allText = [...store.activeSceneChunks.slice(0, chunkIndex), { ...pendingChunk, generatedText: fullText }]
        .map((c) => getCanonicalText(c))
        .join("\n\n");
      const { flags, metrics } = runAudit(allText, store.bible, plan.id);
      store.setAudit(flags, metrics);
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

    store.setExtractingIR(true);
    store.setError(null);

    try {
      const prose = store.activeSceneChunks.map((c) => getCanonicalText(c)).join("\n\n");
      const llmClient: IRLLMClient = {
        call: (systemMessage, userMessage, model, maxTokens) => callLLM(systemMessage, userMessage, model, maxTokens),
      };
      const ir = await extractIR(prose, plan, store.bible, llmClient);
      store.setSceneIR(plan.id, ir);
      store.setIRInspectorOpen(true);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "IR extraction failed");
    } finally {
      store.setExtractingIR(false);
    }
  }

  return { generateChunk, runAuditManual, extractSceneIR };
}
