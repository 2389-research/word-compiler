import React, { useState, useCallback } from "react";
import type { Chunk } from "../../types/index.js";

interface Props {
  chunk: Chunk;
  index: number;
  onUpdate: (index: number, changes: Partial<Chunk>) => void;
}

export function ChunkCard({ chunk, index, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(chunk.editedText ?? chunk.generatedText);
  const [notes, setNotes] = useState(chunk.humanNotes ?? "");

  const statusClass = `badge badge-${chunk.status}`;

  const handleAccept = useCallback(() => {
    onUpdate(index, { status: "accepted", humanNotes: notes || null });
  }, [index, notes, onUpdate]);

  const handleEdit = useCallback(() => {
    if (editing) {
      // Save edit
      onUpdate(index, {
        status: "edited",
        editedText: editText,
        humanNotes: notes || null,
      });
      setEditing(false);
    } else {
      setEditing(true);
    }
  }, [editing, editText, notes, index, onUpdate]);

  const handleReject = useCallback(() => {
    onUpdate(index, { status: "rejected" });
  }, [index, onUpdate]);

  return (
    <div className="chunk-card">
      <div className="chunk-card-header">
        <span>Chunk {index + 1}</span>
        <span className={statusClass}>{chunk.status}</span>
      </div>
      <div className="chunk-card-body">
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            style={{
              width: "100%",
              minHeight: "200px",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              lineHeight: "1.7",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text-primary)",
              padding: "8px",
              resize: "vertical",
            }}
          />
        ) : (
          chunk.editedText ?? chunk.generatedText
        )}
      </div>
      <div className="chunk-card-actions">
        <button onClick={handleAccept} disabled={chunk.status === "accepted"}>
          Accept
        </button>
        <button onClick={handleEdit}>
          {editing ? "Save Edit" : "Edit"}
        </button>
        <button className="danger" onClick={handleReject} disabled={chunk.status === "rejected"}>
          Reject
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {chunk.model} | t={chunk.temperature}
        </span>
      </div>
      <div style={{ padding: "6px 10px" }}>
        <textarea
          className="chunk-notes"
          placeholder="Notes for next chunk (micro-directive)..."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            onUpdate(index, { humanNotes: e.target.value || null });
          }}
        />
      </div>
    </div>
  );
}
