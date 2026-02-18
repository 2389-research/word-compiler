import type { StyleDriftReport } from "../../types/index.js";

interface Props {
  reports: StyleDriftReport[];
  baselineSceneTitle: string;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function DriftCell({ value, flagged }: { value: number; flagged: boolean }) {
  return (
    <td
      style={{
        padding: "6px 12px",
        color: flagged ? "#ff7a7a" : "#7affb0",
        fontFamily: "monospace",
      }}
    >
      {pct(value)} {flagged ? "⚠" : ""}
    </td>
  );
}

export function StyleDriftPanel({ reports, baselineSceneTitle }: Props) {
  if (reports.length === 0) {
    return (
      <div className="pane">
        <div className="pane-header">
          <span>Style Drift</span>
        </div>
        <div style={{ padding: 24, opacity: 0.5, textAlign: "center" }}>
          No drift data available. Complete multiple scenes with metrics to see drift.
        </div>
      </div>
    );
  }

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Style Drift from Chapter 1 Baseline</span>
        <span style={{ fontSize: "0.8em", opacity: 0.5 }}>Baseline: {baselineSceneTitle}</span>
      </div>
      <div style={{ padding: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", opacity: 0.7 }}>
              <th style={{ padding: "6px 12px", textAlign: "left" }}>Scene</th>
              <th style={{ padding: "6px 12px", textAlign: "right" }}>Avg Sentence Len</th>
              <th style={{ padding: "6px 12px", textAlign: "right" }}>Variance</th>
              <th style={{ padding: "6px 12px", textAlign: "right" }}>TTR</th>
              <th style={{ padding: "6px 12px", textAlign: "right" }}>Para Length</th>
              <th style={{ padding: "6px 12px", textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const { driftPercent, flagged, flaggedFields, currentSceneId } = report;
              return (
                <tr key={currentSceneId} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "6px 12px", fontFamily: "monospace", fontSize: "0.8em" }}>
                    {currentSceneId.slice(0, 12)}…
                  </td>
                  <DriftCell
                    value={driftPercent.avgSentenceLength}
                    flagged={flaggedFields.includes("avgSentenceLength")}
                  />
                  <DriftCell
                    value={driftPercent.sentenceLengthVariance}
                    flagged={flaggedFields.includes("sentenceLengthVariance")}
                  />
                  <DriftCell value={driftPercent.typeTokenRatio} flagged={flaggedFields.includes("typeTokenRatio")} />
                  <DriftCell
                    value={driftPercent.avgParagraphLength}
                    flagged={flaggedFields.includes("avgParagraphLength")}
                  />
                  <td style={{ padding: "6px 12px", textAlign: "center" }}>
                    {flagged ? (
                      <span style={{ color: "#ff7a7a" }}>Flagged</span>
                    ) : (
                      <span style={{ color: "#7affb0" }}>OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: "0.8em", opacity: 0.5, marginTop: 8 }}>
          ⚠ = drift &gt;10% from baseline. Style drift target: &lt;10% across all metrics.
        </p>
      </div>
    </div>
  );
}
