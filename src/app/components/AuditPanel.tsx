import React, { useMemo, useState } from "react";
import type { AuditFlag, AuditStats } from "../../types/index.js";
import { getAuditStats } from "../../auditor/index.js";

interface Props {
  flags: AuditFlag[];
  onResolve: (flagId: string, action: string) => void;
  onDismiss: (flagId: string) => void;
}

export function AuditPanel({ flags, onResolve, onDismiss }: Props) {
  const [resolveInput, setResolveInput] = useState<Record<string, string>>({});

  const stats: AuditStats = useMemo(() => getAuditStats(flags), [flags]);

  const critical = flags.filter((f) => f.severity === "critical" && !f.resolved);
  const warnings = flags.filter((f) => f.severity === "warning" && !f.resolved);
  const infos = flags.filter((f) => f.severity === "info" && !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  const handleResolve = (flagId: string) => {
    const action = resolveInput[flagId] ?? "";
    if (!action.trim()) return;
    onResolve(flagId, action);
    setResolveInput((prev) => {
      const next = { ...prev };
      delete next[flagId];
      return next;
    });
  };

  const renderFlag = (flag: AuditFlag) => (
    <div key={flag.id} className={`audit-flag audit-${flag.severity}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong>[{flag.category}]</strong> {flag.message}
          {flag.lineReference && (
            <span style={{ color: "var(--text-muted)" }}> ({flag.lineReference})</span>
          )}
        </div>
      </div>
      {!flag.resolved && (
        <div style={{ marginTop: "6px", display: "flex", gap: "4px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="What did you do?"
            value={resolveInput[flag.id] ?? ""}
            onChange={(e) => setResolveInput((prev) => ({ ...prev, [flag.id]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleResolve(flag.id)}
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              padding: "3px 6px",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              color: "var(--text-primary)",
            }}
          />
          <button style={{ fontSize: "9px" }} onClick={() => handleResolve(flag.id)}>
            Resolve
          </button>
          <button style={{ fontSize: "9px" }} onClick={() => onDismiss(flag.id)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="compiler-section">
      <div className="compiler-section-header">
        <span>Audit</span>
        <span style={{ fontSize: "10px" }}>
          {stats.pending} pending | {Math.round(stats.signalToNoiseRatio * 100)}% actionable
        </span>
      </div>

      {/* Signal-to-noise meter */}
      {stats.total > 0 && (stats.actionable + stats.nonActionable) > 0 && (
        <div style={{ padding: "4px 0", marginBottom: "6px" }}>
          <div style={{
            display: "flex",
            gap: "2px",
            height: "8px",
            borderRadius: "4px",
            overflow: "hidden",
          }}>
            <div style={{
              flex: stats.actionable,
              background: "var(--success)",
            }} />
            <div style={{
              flex: stats.nonActionable,
              background: "var(--warning)",
            }} />
          </div>
          <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
            {stats.actionable} actionable / {stats.nonActionable} noise
            {stats.signalToNoiseRatio < 0.6 && " — below 60% target"}
          </div>
        </div>
      )}

      {flags.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: "11px", padding: "8px 0" }}>
          No audit flags. Run an audit after generating chunks.
        </div>
      )}

      {critical.length > 0 && critical.map(renderFlag)}
      {warnings.length > 0 && warnings.map(renderFlag)}
      {infos.length > 0 && infos.map(renderFlag)}

      {resolved.length > 0 && (
        <details style={{ marginTop: "8px" }}>
          <summary style={{ fontSize: "10px", color: "var(--text-muted)", cursor: "pointer" }}>
            {resolved.length} resolved
          </summary>
          {resolved.map((flag) => (
            <div key={flag.id} className="audit-flag" style={{ opacity: 0.5 }}>
              <strong>[{flag.category}]</strong> {flag.message}
              {flag.resolvedAction && (
                <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  Action: {flag.resolvedAction}
                </div>
              )}
              <span className="badge" style={{ marginLeft: "4px" }}>
                {flag.wasActionable ? "actionable" : "dismissed"}
              </span>
            </div>
          ))}
        </details>
      )}

      {/* Per-category breakdown */}
      {Object.keys(stats.byCategory).length > 0 && (
        <details style={{ marginTop: "8px" }}>
          <summary style={{ fontSize: "10px", color: "var(--text-muted)", cursor: "pointer" }}>
            Category breakdown
          </summary>
          <div style={{ fontSize: "10px", padding: "4px 0" }}>
            {Object.entries(stats.byCategory).map(([cat, data]) => (
              <div key={cat} style={{ color: "var(--text-secondary)" }}>
                {cat}: {data.total} total, {data.actionable} actionable
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
