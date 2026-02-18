import { checkAuditResolutionGate, checkSceneCompletionGate } from "../../gates/index.js";
import type { AuditFlag, Chunk, NarrativeIR, ScenePlan, SceneStatus } from "../../types/index.js";
import { ChunkCard } from "./ChunkCard.js";

interface Props {
  chunks: Chunk[];
  scenePlan: ScenePlan | null;
  sceneStatus: SceneStatus | null;
  isGenerating: boolean;
  canGenerate: boolean;
  gateMessages: string[];
  auditFlags: AuditFlag[];
  sceneIR: NarrativeIR | null;
  isExtractingIR: boolean;
  onGenerate: () => void;
  onUpdateChunk: (index: number, changes: Partial<Chunk>) => void;
  onRemoveChunk: (index: number) => void;
  onRunAudit: () => void;
  onCompleteScene: () => void;
  onOpenIRInspector: () => void;
  onExtractIR: () => void;
}

export function DraftingDesk({
  chunks,
  scenePlan,
  sceneStatus,
  isGenerating,
  canGenerate,
  gateMessages,
  auditFlags,
  sceneIR,
  isExtractingIR,
  onGenerate,
  onUpdateChunk,
  onRemoveChunk,
  onRunAudit,
  onCompleteScene,
  onOpenIRInspector,
  onExtractIR,
}: Props) {
  const maxChunks = scenePlan?.chunkCount ?? Infinity;
  const atChunkLimit = chunks.length >= maxChunks;
  const canGenerateNext = canGenerate && !isGenerating && gateMessages.length === 0 && !atChunkLimit;

  const completionGate = scenePlan ? checkSceneCompletionGate(chunks, scenePlan) : null;
  const auditGate = checkAuditResolutionGate(auditFlags);
  const canComplete = sceneStatus === "drafting" && completionGate?.passed && auditGate.passed;

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Drafting Desk</span>
        <div className="pane-actions">
          {sceneStatus === "complete" && <span className="badge badge-accepted">COMPLETE</span>}
          {/* IR status badge + actions */}
          {sceneStatus === "complete" && (
            <>
              {sceneIR ? (
                <button onClick={onOpenIRInspector} title="View/edit IR">
                  IR {sceneIR.verified ? "✓" : "?"}
                </button>
              ) : (
                <button onClick={onExtractIR} disabled={isExtractingIR} title="Extract Narrative IR">
                  {isExtractingIR ? "Extracting..." : "Extract IR"}
                </button>
              )}
            </>
          )}
          <button onClick={onRunAudit} disabled={chunks.length === 0}>
            Run Audit
          </button>
          {sceneStatus !== "complete" && (
            <button
              className="primary"
              onClick={onGenerate}
              disabled={!canGenerateNext}
              title={gateMessages.length > 0 ? gateMessages.join("\n") : undefined}
            >
              {isGenerating
                ? "Generating..."
                : atChunkLimit
                  ? "All chunks generated"
                  : `Generate Chunk ${chunks.length + 1}`}
            </button>
          )}
          {atChunkLimit && sceneStatus !== "complete" && (
            <button
              className="primary"
              onClick={onCompleteScene}
              disabled={!canComplete}
              title={
                !canComplete
                  ? [...(completionGate?.messages ?? []), ...auditGate.messages].join("\n")
                  : "Mark scene as complete"
              }
            >
              Complete Scene
            </button>
          )}
        </div>
      </div>
      <div className="pane-content">
        {gateMessages.length > 0 && !isGenerating && (
          <div style={{ padding: "6px 8px", marginBottom: "8px" }}>
            {gateMessages.map((msg, i) => (
              <div key={i} className="lint-item lint-warning" style={{ fontSize: "10px" }}>
                {msg}
              </div>
            ))}
          </div>
        )}

        {chunks.length === 0 && !isGenerating && gateMessages.length === 0 && (
          <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
            Load a Bible and Scene Plan, then generate your first chunk.
          </div>
        )}

        {chunks.map((chunk, i) => (
          <ChunkCard
            key={chunk.id}
            chunk={chunk}
            index={i}
            isLast={i === chunks.length - 1}
            onUpdate={onUpdateChunk}
            onRemove={onRemoveChunk}
          />
        ))}

        {isGenerating && (
          <div className="loading">
            <div className="spinner" />
            Generating chunk {chunks.length + 1}
            {scenePlan?.chunkDescriptions[chunks.length] ? `: ${scenePlan.chunkDescriptions[chunks.length]}` : ""}
            ...
          </div>
        )}
      </div>
    </div>
  );
}
