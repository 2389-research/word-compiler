import type { NarrativeIR, ScenePlan } from "../../types/index.js";

interface SceneNode {
  plan: ScenePlan;
  ir: NarrativeIR | null;
  sceneOrder: number;
}

interface Props {
  scenes: SceneNode[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
}

interface ReaderStateDiff {
  newKnowledge: string[];
  newTensions: string[];
  resolvedTensions: string[];
}

function computeReaderStateDiff(prevIR: NarrativeIR | null, currentIR: NarrativeIR): ReaderStateDiff {
  const prevTensions = new Set(prevIR?.unresolvedTensions ?? []);
  const currentTensions = new Set(currentIR.unresolvedTensions);

  return {
    newKnowledge: currentIR.factsRevealedToReader,
    newTensions: currentIR.unresolvedTensions.filter((t) => !prevTensions.has(t)),
    resolvedTensions: [...prevTensions].filter((t) => !currentTensions.has(t)),
  };
}

function SceneNodeCard({
  node,
  index,
  prevIR,
  isActive,
  onClick,
}: {
  node: SceneNode;
  index: number;
  prevIR: NarrativeIR | null;
  isActive: boolean;
  onClick: () => void;
}) {
  const hasIR = node.ir !== null;
  const isVerified = node.ir?.verified ?? false;
  const diff = hasIR && isVerified ? computeReaderStateDiff(prevIR, node.ir!) : null;

  return (
    <button
      onClick={onClick}
      style={{
        background: isActive ? "#2a2a4a" : "#1a1a2e",
        border: `1px solid ${isActive ? "#7070ff" : "#333"}`,
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 160,
        maxWidth: 200,
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: "0.75em", opacity: 0.5, marginBottom: 4 }}>Scene {index + 1}</div>
      <div
        style={{
          fontSize: "0.9em",
          fontWeight: 600,
          marginBottom: 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {node.plan.title || "(untitled)"}
      </div>

      {!hasIR && <div style={{ fontSize: "0.75em", opacity: 0.4 }}>No IR</div>}
      {hasIR && !isVerified && <div style={{ fontSize: "0.75em", opacity: 0.5 }}>IR (unverified)</div>}
      {diff && (
        <div style={{ fontSize: "0.75em" }}>
          {diff.newKnowledge.length > 0 && (
            <div style={{ color: "#7affb0", marginBottom: 2 }}>
              +{diff.newKnowledge.length} fact{diff.newKnowledge.length !== 1 ? "s" : ""} revealed
            </div>
          )}
          {diff.newTensions.length > 0 && (
            <div style={{ color: "#ffaf7a", marginBottom: 2 }}>
              +{diff.newTensions.length} tension{diff.newTensions.length !== 1 ? "s" : ""}
            </div>
          )}
          {diff.resolvedTensions.length > 0 && (
            <div style={{ color: "#aaffaa", marginBottom: 2 }}>-{diff.resolvedTensions.length} resolved</div>
          )}
        </div>
      )}
    </button>
  );
}

export function ForwardSimulator({ scenes, activeSceneIndex, onSelectScene }: Props) {
  if (scenes.length === 0) {
    return (
      <div className="pane">
        <div className="pane-header">
          <span>Forward Simulator</span>
        </div>
        <div style={{ padding: 24, opacity: 0.5, textAlign: "center" }}>No scenes added yet.</div>
      </div>
    );
  }

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Forward Simulator — Reader State Trace</span>
        <span style={{ fontSize: "0.8em", opacity: 0.5 }}>Only verified IRs contribute to state diff.</span>
      </div>
      <div style={{ padding: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {scenes.map((node, i) => (
            <div key={node.plan.id} style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <SceneNodeCard
                node={node}
                index={i}
                prevIR={i > 0 ? (scenes[i - 1]?.ir ?? null) : null}
                isActive={i === activeSceneIndex}
                onClick={() => onSelectScene(i)}
              />
              {i < scenes.length - 1 && <div style={{ opacity: 0.3, fontSize: "1.2em" }}>→</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
