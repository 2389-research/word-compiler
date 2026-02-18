import React, { useCallback } from "react";
import { useProject } from "./hooks/useProject.js";
import { useCompiler } from "./hooks/useCompiler.js";
import { useGeneration } from "./hooks/useGeneration.js";
import { BiblePane } from "./components/BiblePane.js";
import { DraftingDesk } from "./components/DraftingDesk.js";
import { CompilerView } from "./components/CompilerView.js";
import { BootstrapModal } from "./components/BootstrapModal.js";
import type { Chunk } from "../types/index.js";

export function App() {
  const { state, dispatch, loadFile, saveFile, selectModel } = useProject();

  // Auto-recompile when inputs change
  useCompiler(state, dispatch);

  const { generateChunk, runAuditManual } = useGeneration(state, dispatch);

  const handleUpdateChunk = useCallback(
    (index: number, changes: Partial<Chunk>) => {
      dispatch({ type: "UPDATE_CHUNK", index, chunk: changes });
    },
    [dispatch],
  );

  const handleOpenBootstrap = useCallback(() => {
    dispatch({ type: "SET_BOOTSTRAP_OPEN", value: true });
  }, [dispatch]);

  const canGenerate = !!state.bible && !!state.scenePlan && !!state.compiledPayload;

  return (
    <div className="app">
      <div className="app-header">
        <span className="app-title">Word Compiler</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
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
                <option value={state.compilationConfig.defaultModel}>
                  {state.compilationConfig.defaultModel}
                </option>
              )}
            </select>
          </label>
          <span className="app-status">
            {state.bible ? "Bible loaded" : "No bible"} |{" "}
            {state.scenePlan ? `Scene: ${state.scenePlan.title}` : "No scene plan"} |{" "}
            Chunks: {state.chunks.length}
            {state.scenePlan ? `/${state.scenePlan.chunkCount}` : ""}
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

      <div className="cockpit">
        <BiblePane
          bible={state.bible}
          scenePlan={state.scenePlan}
          dispatch={dispatch}
          loadFile={loadFile}
          saveFile={saveFile}
          onBootstrap={handleOpenBootstrap}
        />
        <DraftingDesk
          chunks={state.chunks}
          scenePlan={state.scenePlan}
          isGenerating={state.isGenerating}
          canGenerate={canGenerate}
          onGenerate={generateChunk}
          onUpdateChunk={handleUpdateChunk}
          onRunAudit={runAuditManual}
        />
        <CompilerView
          payload={state.compiledPayload}
          log={state.compilationLog}
          lintResult={state.lintResult}
          auditFlags={state.auditFlags}
          metrics={state.metrics}
        />
      </div>

      <BootstrapModal open={state.bootstrapModalOpen} dispatch={dispatch} />
    </div>
  );
}
