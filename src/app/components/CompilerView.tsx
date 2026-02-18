import React from "react";
import type { CompiledPayload, CompilationLog, LintResult, AuditFlag, ProseMetrics } from "../../types/index.js";

interface Props {
  payload: CompiledPayload | null;
  log: CompilationLog | null;
  lintResult: LintResult | null;
  auditFlags: AuditFlag[];
  metrics: ProseMetrics | null;
}

export function CompilerView({ payload, log, lintResult, auditFlags, metrics }: Props) {
  if (!payload || !log) {
    return (
      <div className="pane">
        <div className="pane-header">Compiler View</div>
        <div className="pane-content">
          <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
            Load a Bible and Scene Plan to see the compiled payload.
          </div>
        </div>
      </div>
    );
  }

  const total = log.ring1Tokens + log.ring3Tokens;
  const r1Pct = total > 0 ? Math.round((log.ring1Tokens / log.availableBudget) * 100) : 0;
  const r3Pct = total > 0 ? Math.round((log.ring3Tokens / log.availableBudget) * 100) : 0;
  const freePct = Math.max(0, 100 - r1Pct - r3Pct);

  const lintErrors = lintResult?.issues.filter((i) => i.severity === "error") ?? [];
  const lintWarnings = lintResult?.issues.filter((i) => i.severity === "warning") ?? [];
  const lintInfos = lintResult?.issues.filter((i) => i.severity === "info") ?? [];

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Compiler View</span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {total.toLocaleString()} / {log.availableBudget.toLocaleString()} tokens
        </span>
      </div>
      <div className="pane-content">
        {/* Budget Bar */}
        <div className="budget-bar">
          {r1Pct > 0 && (
            <div className="budget-segment budget-r1" style={{ flex: r1Pct }}>
              R1 {r1Pct}%
            </div>
          )}
          {r3Pct > 0 && (
            <div className="budget-segment budget-r3" style={{ flex: r3Pct }}>
              R3 {r3Pct}%
            </div>
          )}
          {freePct > 0 && (
            <div className="budget-segment budget-free" style={{ flex: freePct }}>
              free
            </div>
          )}
        </div>

        {/* System Message (Ring 1) */}
        <div className="compiler-section">
          <div className="compiler-section-header">
            <span>System Message (Ring 1)</span>
            <span>{log.ring1Tokens} tokens</span>
          </div>
          <div className="compiler-text">{payload.systemMessage}</div>
        </div>

        {/* User Message (Ring 3 + Gen Instruction) */}
        <div className="compiler-section">
          <div className="compiler-section-header">
            <span>User Message (Ring 3)</span>
            <span>{log.ring3Tokens} tokens</span>
          </div>
          <div className="compiler-text">{payload.userMessage}</div>
        </div>

        {/* Sections included */}
        <div className="compiler-section">
          <div className="compiler-section-header">Sections Included</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            <strong>R1:</strong> {log.ring1Contents.join(", ") || "none"}
            <br />
            <strong>R3:</strong> {log.ring3Contents.join(", ") || "none"}
          </div>
        </div>

        {/* Lint Results */}
        <div className="compiler-section">
          <div className="compiler-section-header">
            <span>Lint</span>
            <span>
              {lintErrors.length}E {lintWarnings.length}W {lintInfos.length}I
            </span>
          </div>
          {lintErrors.map((issue, i) => (
            <div key={i} className="lint-item lint-error">
              <span className="lint-code">{issue.code}</span>
              <span>{issue.message}</span>
            </div>
          ))}
          {lintWarnings.map((issue, i) => (
            <div key={i} className="lint-item lint-warning">
              <span className="lint-code">{issue.code}</span>
              <span>{issue.message}</span>
            </div>
          ))}
          {lintInfos.map((issue, i) => (
            <div key={i} className="lint-item lint-info">
              <span className="lint-code">{issue.code}</span>
              <span>{issue.message}</span>
            </div>
          ))}
          {lintResult?.issues.length === 0 && (
            <div style={{ color: "var(--success)", fontSize: "11px" }}>All checks passed</div>
          )}
        </div>

        {/* Audit Flags */}
        {auditFlags.length > 0 && (
          <div className="compiler-section">
            <div className="compiler-section-header">
              <span>Audit Flags</span>
              <span>{auditFlags.length}</span>
            </div>
            {auditFlags.map((flag) => (
              <div
                key={flag.id}
                className={`audit-flag audit-${flag.severity}`}
              >
                <strong>[{flag.category}]</strong> {flag.message}
                {flag.lineReference && (
                  <span style={{ color: "var(--text-muted)" }}> ({flag.lineReference})</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Metrics */}
        {metrics && (
          <div className="compiler-section">
            <div className="compiler-section-header">Prose Metrics</div>
            <div className="metrics-grid">
              <div className="metric">
                <div className="metric-label">Words</div>
                <div className="metric-value">{metrics.wordCount}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Sentences</div>
                <div className="metric-value">{metrics.sentenceCount}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Avg Sentence</div>
                <div className="metric-value">{metrics.avgSentenceLength.toFixed(1)}w</div>
              </div>
              <div className="metric">
                <div className="metric-label">Variance</div>
                <div
                  className="metric-value"
                  style={{ color: metrics.sentenceLengthVariance >= 3 ? "var(--success)" : "var(--warning)" }}
                >
                  {metrics.sentenceLengthVariance.toFixed(1)}
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">TTR</div>
                <div className="metric-value">{metrics.typeTokenRatio.toFixed(2)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Paragraphs</div>
                <div className="metric-value">{metrics.paragraphCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* Gen Params */}
        <div className="compiler-section">
          <div className="compiler-section-header">Generation Parameters</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Model: {payload.model} | Temp: {payload.temperature} | Top-P: {payload.topP} | Max: {payload.maxTokens}
          </div>
        </div>
      </div>
    </div>
  );
}
