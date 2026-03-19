import { apiUpdateProjectVoiceGuide } from "../../api/client.js";
import { checkAuditResolutionGate, checkSceneCompletionGate } from "../../gates/index.js";
import { buildContinuousText, findChunksForRange } from "../../review/refine.js";
import type { ChunkBoundary } from "../../review/refineTypes.js";
import type { AuditFlag, Bible, ChapterArc, Chunk, CompilationLog, NarrativeIR, ScenePlan } from "../../types/index.js";
import { getCanonicalText } from "../../types/index.js";
import type { ApiActions } from "./api-actions.js";
import type { ProjectStore } from "./project.svelte.js";

// ─── Result type ─────────────────────────────────────

export type CommandResult<T = void> = { ok: true; value: T } | { ok: false; error: string; gateFailures?: string[] };

function success(): CommandResult<void>;
function success<T>(value: T): CommandResult<T>;
function success<T>(value?: T): CommandResult<T> {
  return { ok: true, value: value as T };
}

function failure(error: string, gateFailures?: string[]): CommandResult<never> {
  return { ok: false, error, gateFailures };
}

// ─── Factory ─────────────────────────────────────────

/**
 * Creates the command layer — the single public write path for all
 * persisted mutations. Wraps store + api-actions and enforces gates.
 *
 * When `actions` is undefined (Storybook / store-only mode), persist
 * calls silently no-op and the store is updated directly as fallback.
 */
export function createCommands(store: ProjectStore, actions?: ApiActions) {
  function handleError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    store.setError(msg);
    return msg;
  }

  // ─── Bible ──────────────────────────────────────

  async function saveBible(bible: Bible): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveBible(bible);
      } else {
        store.setBible(bible);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Scene Plans ────────────────────────────────

  async function saveScenePlan(plan: ScenePlan, order: number): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveScenePlan(plan, order);
      } else if (store.scenes.length > 0) {
        store.addScenePlan(plan);
      } else {
        store.setScenePlan(plan);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function updateScenePlan(plan: ScenePlan): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.updateScenePlan(plan);
      } else {
        store.addScenePlan(plan);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function saveMultipleScenePlans(plans: ScenePlan[]): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveMultipleScenePlans(plans);
      } else {
        store.addMultipleScenePlans(plans);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Chapter Arc ────────────────────────────────

  async function saveChapterArc(arc: ChapterArc): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveChapterArc(arc);
      } else {
        store.setChapterArc(arc);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function updateChapterArc(arc: ChapterArc): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.updateChapterArc(arc);
      } else {
        store.setChapterArc(arc);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Chunks ─────────────────────────────────────

  async function saveChunk(chunk: Chunk): Promise<CommandResult> {
    try {
      if (actions) await actions.saveChunk(chunk);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function updateChunk(sceneId: string, index: number, changes: Partial<Chunk>): Promise<CommandResult> {
    try {
      store.updateChunkForScene(sceneId, index, changes);
      const updated = (store.sceneChunks[sceneId] ?? [])[index];
      if (updated && actions) await actions.updateChunk(updated);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  /**
   * API-only persist — no store mutation. Used for debounced text edits
   * where the store was already updated via `store.updateChunkForScene()`
   * for immediate UI responsiveness.
   */
  async function persistChunk(sceneId: string, index: number): Promise<CommandResult> {
    try {
      const chunk = (store.sceneChunks[sceneId] ?? [])[index];
      if (chunk && actions) await actions.updateChunk(chunk);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function removeChunk(sceneId: string, index: number): Promise<CommandResult> {
    try {
      const chunks = store.sceneChunks[sceneId] ?? [];
      const target = chunks[index];

      // Delete from server first
      if (target && actions) await actions.deleteChunk(target.id);

      // Filter + renumber
      const updated = chunks.filter((_, i) => i !== index).map((c, i) => ({ ...c, sequenceNumber: i }));
      store.setSceneChunks(sceneId, updated);

      // Persist renumbered chunks concurrently
      if (actions) {
        await Promise.all(updated.map((c) => actions.updateChunk(c)));
      }

      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Scene Completion (gated) ───────────────────

  async function completeScene(sceneId: string): Promise<CommandResult> {
    try {
      const chunks = store.sceneChunks[sceneId] ?? [];
      const scene = store.scenes.find((s) => s.plan.id === sceneId);
      if (!scene) return failure("Scene not found");

      const completionGate = checkSceneCompletionGate(chunks, scene.plan);
      const auditGate = checkAuditResolutionGate(store.auditFlags);

      if (!completionGate.passed || !auditGate.passed) {
        const gateFailures = [...completionGate.messages, ...auditGate.messages];
        const msg = `Scene cannot be completed: ${gateFailures.join("; ")}`;
        store.setError(msg);
        return failure(msg, gateFailures);
      }

      if (actions) {
        await actions.completeScene(sceneId);
      } else {
        store.completeScene(sceneId);
      }

      // After successful scene completion, update project voice guide
      const sceneChunks = store.sceneChunks[sceneId] ?? [];
      const sceneText = sceneChunks
        .map((c) => getCanonicalText(c))
        .filter((t) => t.trim())
        .join("\n\n");

      if (sceneText.trim() && store.project) {
        apiUpdateProjectVoiceGuide(store.project.id, sceneId, sceneText)
          .then(({ projectGuide, ring1Injection }) => {
            store.setProjectVoiceGuide(projectGuide);
            // Update the author voice guide's ring1Injection (re-distilled from all 3 sources)
            if (store.voiceGuide && ring1Injection) {
              store.setVoiceGuide({ ...store.voiceGuide, ring1Injection });
            }
            console.log(`[profile] Voice updated: project v${projectGuide.version}`);
          })
          .catch((err) => console.warn("[profile] Voice update failed:", err));
      }

      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Audit Flags ────────────────────────────────

  async function saveAuditFlags(flags: AuditFlag[]): Promise<CommandResult> {
    try {
      if (actions) await actions.saveAuditFlags(flags);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function resolveAuditFlag(flagId: string, action: string, wasActionable: boolean): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.resolveAuditFlag(flagId, action, wasActionable);
      } else {
        store.resolveAuditFlag(flagId, action, wasActionable);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function dismissAuditFlag(flagId: string): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.dismissAuditFlag(flagId);
      } else {
        store.dismissAuditFlag(flagId);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Scene IR ───────────────────────────────────

  async function saveSceneIR(sceneId: string, ir: NarrativeIR): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveSceneIR(sceneId, ir);
      } else {
        store.setSceneIR(sceneId, ir);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function verifySceneIR(sceneId: string): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.verifySceneIR(sceneId);
      } else {
        store.verifySceneIR(sceneId);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Compilation Log ────────────────────────────

  async function saveCompilationLog(log: CompilationLog): Promise<CommandResult> {
    try {
      if (actions) await actions.saveCompilationLog(log);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Refinement ──────────────────────────────────

  const BOUNDS_ERROR = "Selection bounds out of range. Text may have changed — please re-select.";

  function checkLocalBounds(localStart: number, localEnd: number, textLength: number): CommandResult | null {
    if (localStart < 0 || localEnd > textLength || localStart > localEnd) {
      return failure(BOUNDS_ERROR);
    }
    return null;
  }

  async function applySingleChunkRefinement(
    sceneId: string,
    boundary: ChunkBoundary,
    chunks: Chunk[],
    selectionStart: number,
    selectionEnd: number,
    replacementText: string,
  ): Promise<CommandResult> {
    const chunk = chunks[boundary.chunkIndex];
    if (!chunk) return failure("Chunk not found");
    const chunkText = getCanonicalText(chunk);
    const localStart = selectionStart - boundary.startOffset;
    const localEnd = selectionEnd - boundary.startOffset;
    const boundsErr = checkLocalBounds(localStart, localEnd, chunkText.length);
    if (boundsErr) return boundsErr;
    const newText = chunkText.slice(0, localStart) + replacementText + chunkText.slice(localEnd);
    return await updateChunk(sceneId, boundary.chunkIndex, { editedText: newText, status: "edited" });
  }

  async function updateLastChunk(
    sceneId: string,
    lastChunk: Chunk,
    lastBoundary: ChunkBoundary,
    selectionEnd: number,
  ): Promise<CommandResult> {
    const lastText = getCanonicalText(lastChunk);
    const localLastEnd = selectionEnd - lastBoundary.startOffset;
    const boundsErr = checkLocalBounds(0, localLastEnd, lastText.length);
    if (boundsErr) return boundsErr;
    return await updateChunk(sceneId, lastBoundary.chunkIndex, {
      editedText: lastText.slice(localLastEnd),
      status: "edited",
    });
  }

  async function emptyMiddleChunks(sceneId: string, startIndex: number, endIndex: number): Promise<CommandResult> {
    for (let i = startIndex; i < endIndex; i++) {
      const result = await updateChunk(sceneId, i, { editedText: "", status: "edited" });
      if (!result.ok) return result;
    }
    return success();
  }

  async function applyMultiChunkRefinement(
    sceneId: string,
    affected: ChunkBoundary[],
    chunks: Chunk[],
    selectionStart: number,
    selectionEnd: number,
    replacementText: string,
  ): Promise<CommandResult> {
    const firstBoundary = affected[0]!;
    const lastBoundary = affected[affected.length - 1]!;
    const firstChunk = chunks[firstBoundary.chunkIndex];
    const lastChunk = chunks[lastBoundary.chunkIndex];
    if (!firstChunk || !lastChunk) return failure("Chunk not found");

    const firstText = getCanonicalText(firstChunk);
    const localFirstStart = selectionStart - firstBoundary.startOffset;
    const firstBoundsErr = checkLocalBounds(localFirstStart, firstText.length, firstText.length);
    if (firstBoundsErr) return firstBoundsErr;
    const firstResult = await updateChunk(sceneId, firstBoundary.chunkIndex, {
      editedText: firstText.slice(0, localFirstStart) + replacementText,
      status: "edited",
    });
    if (!firstResult.ok) return firstResult;

    if (lastBoundary.chunkIndex !== firstBoundary.chunkIndex) {
      const lastResult = await updateLastChunk(sceneId, lastChunk, lastBoundary, selectionEnd);
      if (!lastResult.ok) return lastResult;
    }

    return await emptyMiddleChunks(sceneId, firstBoundary.chunkIndex + 1, lastBoundary.chunkIndex);
  }

  async function applyRefinement(
    sceneId: string,
    selectionStart: number,
    selectionEnd: number,
    replacementText: string,
  ): Promise<CommandResult> {
    try {
      const chunks = store.sceneChunks[sceneId] ?? [];
      if (chunks.length === 0) return failure("No chunks found for scene");
      const { boundaries } = buildContinuousText(chunks);
      const affected = findChunksForRange(selectionStart, selectionEnd, boundaries);
      if (affected.length === 0) return failure("No chunks found for selection range");

      if (affected.length === 1) {
        return await applySingleChunkRefinement(
          sceneId,
          affected[0]!,
          chunks,
          selectionStart,
          selectionEnd,
          replacementText,
        );
      }
      return await applyMultiChunkRefinement(sceneId, affected, chunks, selectionStart, selectionEnd, replacementText);
    } catch (err) {
      return failure(handleError(err));
    }
  }

  return {
    saveBible,
    saveScenePlan,
    updateScenePlan,
    saveMultipleScenePlans,
    saveChapterArc,
    updateChapterArc,
    saveChunk,
    updateChunk,
    persistChunk,
    removeChunk,
    completeScene,
    saveAuditFlags,
    resolveAuditFlag,
    dismissAuditFlag,
    saveSceneIR,
    verifySceneIR,
    saveCompilationLog,
    applyRefinement,
  };
}

export type Commands = ReturnType<typeof createCommands>;
