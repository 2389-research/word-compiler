import React from "react";
import type { Chunk, ScenePlan } from "../../types/index.js";
import { ChunkCard } from "./ChunkCard.js";

interface Props {
  chunks: Chunk[];
  scenePlan: ScenePlan | null;
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onUpdateChunk: (index: number, changes: Partial<Chunk>) => void;
  onRunAudit: () => void;
}

export function DraftingDesk({
  chunks,
  scenePlan,
  isGenerating,
  canGenerate,
  onGenerate,
  onUpdateChunk,
  onRunAudit,
}: Props) {
  const lastChunk = chunks[chunks.length - 1];
  const canGenerateNext =
    canGenerate &&
    !isGenerating &&
    (chunks.length === 0 || lastChunk?.status === "accepted" || lastChunk?.status === "edited");

  const maxChunks = scenePlan?.chunkCount ?? Infinity;
  const atChunkLimit = chunks.length >= maxChunks;

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Drafting Desk</span>
        <div className="pane-actions">
          <button onClick={onRunAudit} disabled={chunks.length === 0}>
            Run Audit
          </button>
          <button
            className="primary"
            onClick={onGenerate}
            disabled={!canGenerateNext || atChunkLimit}
          >
            {isGenerating
              ? "Generating..."
              : atChunkLimit
                ? "All chunks generated"
                : `Generate Chunk ${chunks.length + 1}`}
          </button>
        </div>
      </div>
      <div className="pane-content">
        {chunks.length === 0 && !isGenerating && (
          <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
            Load a Bible and Scene Plan, then generate your first chunk.
          </div>
        )}

        {chunks.map((chunk, i) => (
          <ChunkCard key={chunk.id} chunk={chunk} index={i} onUpdate={onUpdateChunk} />
        ))}

        {isGenerating && (
          <div className="loading">
            <div className="spinner" />
            Generating chunk {chunks.length + 1}
            {scenePlan?.chunkDescriptions[chunks.length]
              ? `: ${scenePlan.chunkDescriptions[chunks.length]}`
              : ""}
            ...
          </div>
        )}
      </div>
    </div>
  );
}
