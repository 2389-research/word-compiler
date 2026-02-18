import React, { useCallback } from "react";
import type { ChapterArc, ReaderState } from "../../types/index.js";
import type { AppAction } from "../hooks/useProject.js";

interface Props {
  arc: ChapterArc;
  dispatch: React.Dispatch<AppAction>;
  onClose: () => void;
}

function ReaderStateFields({
  label,
  state,
  onChange,
}: {
  label: string;
  state: ReaderState;
  onChange: (rs: ReaderState) => void;
}) {
  return (
    <fieldset className="arc-fieldset">
      <legend>{label}</legend>
      <label>
        Knows
        <input
          type="text"
          value={state.knows.join(", ")}
          onChange={(e) => onChange({ ...state, knows: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Comma-separated items"
        />
      </label>
      <label>
        Suspects
        <input
          type="text"
          value={state.suspects.join(", ")}
          onChange={(e) => onChange({ ...state, suspects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Comma-separated items"
        />
      </label>
      <label>
        Wrong about
        <input
          type="text"
          value={state.wrongAbout.join(", ")}
          onChange={(e) => onChange({ ...state, wrongAbout: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Comma-separated items"
        />
      </label>
      <label>
        Active tensions
        <input
          type="text"
          value={state.activeTensions.join(", ")}
          onChange={(e) => onChange({ ...state, activeTensions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Comma-separated items"
        />
      </label>
    </fieldset>
  );
}

export function ChapterArcEditor({ arc, dispatch, onClose }: Props) {
  const update = useCallback(
    (changes: Partial<ChapterArc>) => {
      dispatch({ type: "SET_CHAPTER_ARC", arc: { ...arc, ...changes } });
    },
    [arc, dispatch],
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "700px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Chapter Arc Editor</div>
        <div className="modal-body arc-editor">
          <label>
            Working Title
            <input type="text" value={arc.workingTitle} onChange={(e) => update({ workingTitle: e.target.value })} />
          </label>
          <label>
            Narrative Function
            <textarea value={arc.narrativeFunction} onChange={(e) => update({ narrativeFunction: e.target.value })} rows={2} />
          </label>
          <label>
            Dominant Register
            <input type="text" value={arc.dominantRegister} onChange={(e) => update({ dominantRegister: e.target.value })} />
          </label>
          <label>
            Pacing Target
            <input type="text" value={arc.pacingTarget} onChange={(e) => update({ pacingTarget: e.target.value })} />
          </label>
          <label>
            Ending Posture
            <input type="text" value={arc.endingPosture} onChange={(e) => update({ endingPosture: e.target.value })} />
          </label>
          <ReaderStateFields
            label="Reader State Entering"
            state={arc.readerStateEntering}
            onChange={(rs) => update({ readerStateEntering: rs })}
          />
          <ReaderStateFields
            label="Reader State Exiting"
            state={arc.readerStateExiting}
            onChange={(rs) => update({ readerStateExiting: rs })}
          />
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
