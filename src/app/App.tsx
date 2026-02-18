import { useCallback, useMemo, useState } from "react";
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../gates/index.js";
import type { Chunk } from "../types/index.js";
import { BiblePane } from "./components/BiblePane.js";
import { BootstrapModal } from "./components/BootstrapModal.js";
import { ChapterArcEditor } from "./components/ChapterArcEditor.js";
import { CompilerView } from "./components/CompilerView.js";
import { DraftingDesk } from "./components/DraftingDesk.js";
import { SceneSequencer } from "./components/SceneSequencer.js";
import { useCompiler } from "./hooks/useCompiler.js";
import { useGeneration } from "./hooks/useGeneration.js";
import { useProject } from "./hooks/useProject.js";

export function App() {
  const {
    state,
    dispatch,
    loadFile,
    saveFile,
    selectModel,
    activeScene,
    activeScenePlan,
    activeSceneChunks,
    previousSceneLastChunk,
  } = useProject();

  const [showArcEditor, setShowArcEditor] = useState(false);

  // Auto-recompile when inputs change
  useCompiler(state, dispatch, activeScenePlan, activeSceneChunks, previousSceneLastChunk);

  const { generateChunk, runAuditManual } = useGeneration(state, dispatch, activeScenePlan, activeSceneChunks);

  const handleUpdateChunk = useCallback(
    (index: number, changes: Partial<Chunk>) => {
      dispatch({ type: "UPDATE_CHUNK", index, chunk: changes });
    },
    [dispatch],
  );

  const handleRemoveChunk = useCallback(
    (index: number) => {
      dispatch({ type: "REMOVE_CHUNK", index });
    },
    [dispatch],
  );

  const handleOpenBootstrap = useCallback(() => {
    dispatch({ type: "SET_BOOTSTRAP_OPEN", value: true });
  }, [dispatch]);

  const handleCompleteScene = useCallback(() => {
    if (activeScenePlan) {
      dispatch({ type: "COMPLETE_SCENE", sceneId: activeScenePlan.id });
    }
  }, [activeScenePlan, dispatch]);

  const handleOpenIRInspector = useCallback(() => {
    dispatch({ type: "SET_IR_INSPECTOR_OPEN", value: true });
  }, [dispatch]);

  const handleExtractIR = useCallback(() => {
    // IR extraction is triggered from the UI; the actual LLM call is handled
    // in a separate async flow. For now, open the inspector to show pending state.
    dispatch({ type: "SET_IR_INSPECTOR_OPEN", value: true });
  }, [dispatch]);

  const handleResolveFlag = useCallback(
    (flagId: string, action: string) => {
      dispatch({ type: "RESOLVE_AUDIT_FLAG", flagId, action, wasActionable: true });
    },
    [dispatch],
  );

  const handleDismissFlag = useCallback(
    (flagId: string) => {
      dispatch({ type: "DISMISS_AUDIT_FLAG", flagId, action: "" });
    },
    [dispatch],
  );

  const canGenerate = !!state.bible && !!activeScenePlan && !!state.compiledPayload;
  const activeSceneIR = activeScenePlan ? (state.sceneIRs[activeScenePlan.id] ?? null) : null;

  // Gate messages — computed each render for instant feedback
  const gateMessages = useMemo(() => {
    const msgs: string[] = [];
    if (!state.bible) msgs.push("No bible loaded.");
    if (!activeScenePlan) msgs.push("No scene plan selected.");
    if (activeScenePlan) {
      const planGate = checkScenePlanGate(activeScenePlan);
      msgs.push(...planGate.messages);
    }
    if (state.lintResult) {
      const compileGate = checkCompileGate(state.lintResult);
      msgs.push(...compileGate.messages);
    }
    if (activeSceneChunks.length > 0) {
      const lastChunk = activeSceneChunks[activeSceneChunks.length - 1]!;
      const reviewGate = checkChunkReviewGate(lastChunk);
      msgs.push(...reviewGate.messages);
    }
    return msgs;
  }, [state.bible, activeScenePlan, state.lintResult, activeSceneChunks]);

  return (
    <div className="app">
      <div className="app-header">
        <span className="app-title">Word Compiler</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {state.chapterArc && (
            <button onClick={() => setShowArcEditor(true)} style={{ fontSize: "10px" }}>
              Chapter Arc
            </button>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "var(--text-secondary)",
            }}
          >
            Model:
            <select
              value={state.compilationConfig.defaultModel}
              onChange={(e) => selectModel(e.target.value)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: "3px",
                color: "var(--text-primary)",
                padding: "2px 6px",
              }}
            >
              {state.availableModels.length > 0 ? (
                state.availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({(m.contextWindow / 1000).toFixed(0)}k ctx, {(m.maxOutput / 1000).toFixed(0)}k out)
                  </option>
                ))
              ) : (
                <option value={state.compilationConfig.defaultModel}>{state.compilationConfig.defaultModel}</option>
              )}
            </select>
          </label>
          <span className="app-status">
            {state.bible ? `Bible v${state.bible.version}` : "No bible"} |{" "}
            {activeScenePlan ? `Scene: ${activeScenePlan.title}` : "No scene plan"} | Chunks: {activeSceneChunks.length}
            {activeScenePlan ? `/${activeScenePlan.chunkCount}` : ""}
          </span>
        </div>
      </div>

      {state.error && (
        <div className="error-banner" style={{ margin: "0 8px" }}>
          {state.error}
          <button
            style={{ marginLeft: "8px", fontSize: "10px" }}
            onClick={() => dispatch({ type: "SET_ERROR", error: null })}
          >
            dismiss
          </button>
        </div>
      )}

      <SceneSequencer
        scenes={state.scenes}
        activeSceneIndex={state.activeSceneIndex}
        sceneChunks={state.sceneChunks}
        dispatch={dispatch}
      />

      <div className="cockpit">
        <BiblePane
          bible={state.bible}
          scenePlan={activeScenePlan}
          dispatch={dispatch}
          loadFile={loadFile}
          saveFile={saveFile}
          onBootstrap={handleOpenBootstrap}
        />
        <DraftingDesk
          chunks={activeSceneChunks}
          scenePlan={activeScenePlan}
          sceneStatus={activeScene?.status ?? null}
          isGenerating={state.isGenerating}
          canGenerate={canGenerate}
          gateMessages={gateMessages}
          auditFlags={state.auditFlags}
          sceneIR={activeSceneIR}
          isExtractingIR={false}
          onGenerate={generateChunk}
          onUpdateChunk={handleUpdateChunk}
          onRemoveChunk={handleRemoveChunk}
          onRunAudit={runAuditManual}
          onCompleteScene={handleCompleteScene}
          onOpenIRInspector={handleOpenIRInspector}
          onExtractIR={handleExtractIR}
        />
        <CompilerView
          payload={state.compiledPayload}
          log={state.compilationLog}
          lintResult={state.lintResult}
          auditFlags={state.auditFlags}
          metrics={state.metrics}
          onResolveFlag={handleResolveFlag}
          onDismissFlag={handleDismissFlag}
        />
      </div>

      <BootstrapModal open={state.bootstrapModalOpen} dispatch={dispatch} />

      {showArcEditor && state.chapterArc && (
        <ChapterArcEditor arc={state.chapterArc} dispatch={dispatch} onClose={() => setShowArcEditor(false)} />
      )}
    </div>
  );
}
