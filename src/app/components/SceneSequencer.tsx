import React from "react";
import type { Chunk, SceneStatus } from "../../types/index.js";
import type { SceneEntry, AppAction } from "../hooks/useProject.js";

interface Props {
  scenes: SceneEntry[];
  activeSceneIndex: number;
  sceneChunks: Record<string, Chunk[]>;
  dispatch: React.Dispatch<AppAction>;
}

const STATUS_LABELS: Record<SceneStatus, string> = {
  planned: "PLANNED",
  drafting: "DRAFTING",
  complete: "COMPLETE",
};

const STATUS_CLASSES: Record<SceneStatus, string> = {
  planned: "badge-pending",
  drafting: "badge-edited",
  complete: "badge-accepted",
};

export function SceneSequencer({ scenes, activeSceneIndex, sceneChunks, dispatch }: Props) {
  if (scenes.length === 0) return null;

  return (
    <div className="scene-sequencer">
      {scenes.map((entry, i) => {
        const chunks = sceneChunks[entry.plan.id] ?? [];
        const isActive = i === activeSceneIndex;
        return (
          <button
            key={entry.plan.id}
            className={`scene-card ${isActive ? "scene-card-active" : ""}`}
            onClick={() => dispatch({ type: "SET_ACTIVE_SCENE", index: i })}
          >
            <div className="scene-card-title">
              {entry.plan.title || `Scene ${i + 1}`}
            </div>
            <div className="scene-card-meta">
              <span className={`badge ${STATUS_CLASSES[entry.status]}`}>
                {STATUS_LABELS[entry.status]}
              </span>
              <span className="scene-card-chunks">
                {chunks.length}/{entry.plan.chunkCount}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
