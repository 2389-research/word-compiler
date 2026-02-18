import React, { useRef, useEffect, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter } from "@codemirror/language";
import type { Bible, ScenePlan } from "../../types/index.js";
import type { AppAction } from "../hooks/useProject.js";

interface Props {
  bible: Bible | null;
  scenePlan: ScenePlan | null;
  dispatch: React.Dispatch<AppAction>;
  loadFile: () => Promise<string | null>;
  saveFile: (data: unknown, filename: string) => void;
  onBootstrap: () => void;
}

function JsonEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        json(),
        oneDark,
        lineNumbers(),
        bracketMatching(),
        foldGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // Only create on mount — value updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g., file load)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div className="editor-section">
      <div className="editor-label">{label}</div>
      <div className="editor-wrapper" ref={containerRef} />
    </div>
  );
}

export function BiblePane({ bible, scenePlan, dispatch, loadFile, saveFile, onBootstrap }: Props) {
  const bibleJson = bible ? JSON.stringify(bible, null, 2) : "";
  const planJson = scenePlan ? JSON.stringify(scenePlan, null, 2) : "";

  const handleBibleChange = useCallback(
    (text: string) => {
      try {
        const parsed = JSON.parse(text) as Bible;
        dispatch({ type: "SET_BIBLE", bible: parsed });
      } catch {
        // Invalid JSON — don't update state until valid
      }
    },
    [dispatch],
  );

  const handlePlanChange = useCallback(
    (text: string) => {
      try {
        const parsed = JSON.parse(text) as ScenePlan;
        dispatch({ type: "SET_SCENE_PLAN", plan: parsed });
      } catch {
        // Invalid JSON
      }
    },
    [dispatch],
  );

  const handleLoadBible = useCallback(async () => {
    const text = await loadFile();
    if (text) {
      try {
        const parsed = JSON.parse(text) as Bible;
        dispatch({ type: "SET_BIBLE", bible: parsed });
      } catch {
        dispatch({ type: "SET_ERROR", error: "Invalid Bible JSON" });
      }
    }
  }, [loadFile, dispatch]);

  const handleLoadPlan = useCallback(async () => {
    const text = await loadFile();
    if (text) {
      try {
        const parsed = JSON.parse(text) as ScenePlan;
        dispatch({ type: "SET_SCENE_PLAN", plan: parsed });
      } catch {
        dispatch({ type: "SET_ERROR", error: "Invalid Scene Plan JSON" });
      }
    }
  }, [loadFile, dispatch]);

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Bible + Plan</span>
        <div className="pane-actions">
          <button onClick={onBootstrap}>Bootstrap</button>
        </div>
      </div>
      <div className="pane-content" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={handleLoadBible}>Load Bible</button>
          <button onClick={() => bible && saveFile(bible, "bible.json")} disabled={!bible}>
            Save Bible
          </button>
          <button onClick={handleLoadPlan}>Load Plan</button>
          <button onClick={() => scenePlan && saveFile(scenePlan, "scene-plan.json")} disabled={!scenePlan}>
            Save Plan
          </button>
          {bible && (
            <span style={{ fontSize: "10px", color: "var(--accent-dim)", marginLeft: "auto" }}>
              v{bible.version}
            </span>
          )}
        </div>
        <JsonEditor value={bibleJson} onChange={handleBibleChange} label="Bible JSON" />
        <JsonEditor value={planJson} onChange={handlePlanChange} label="Scene Plan JSON" />
      </div>
    </div>
  );
}
