import type { VoiceSeparabilityReport } from "../../types/index.js";

interface Props {
  report: VoiceSeparabilityReport | null;
}

export function VoiceSeparabilityView({ report }: Props) {
  if (!report) {
    return (
      <div className="pane">
        <div className="pane-header">
          <span>Voice Separability</span>
        </div>
        <div style={{ padding: 24, opacity: 0.5, textAlign: "center" }}>
          No voice separability data. Complete scenes with dialogue to analyze.
        </div>
      </div>
    );
  }

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Voice Separability</span>
        <span style={{ fontSize: "0.85em" }}>
          {report.separable ? (
            <span style={{ color: "#7affb0" }}>Voices distinguishable</span>
          ) : (
            <span style={{ color: "#ff7a7a" }}>Voices may be indistinguishable</span>
          )}
        </span>
      </div>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 0 }}>{report.detail}</p>
        <p style={{ fontSize: "0.85em", opacity: 0.5 }}>
          Inter-character sentence length variance: <strong>{report.interCharacterVariance.toFixed(2)}</strong> words
          (threshold: 1.5)
        </p>

        {report.characterStats.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em", marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", opacity: 0.7 }}>
                <th style={{ padding: "6px 12px", textAlign: "left" }}>Character</th>
                <th style={{ padding: "6px 12px", textAlign: "right" }}>Dialogue Lines</th>
                <th style={{ padding: "6px 12px", textAlign: "right" }}>Avg Sentence Len</th>
                <th style={{ padding: "6px 12px", textAlign: "right" }}>Variance</th>
                <th style={{ padding: "6px 12px", textAlign: "right" }}>TTR</th>
              </tr>
            </thead>
            <tbody>
              {report.characterStats.map((stat) => (
                <tr key={stat.characterId} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "6px 12px" }}>{stat.characterName}</td>
                  <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace" }}>
                    {stat.dialogueCount}
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace" }}>
                    {stat.avgSentenceLength.toFixed(1)}
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace" }}>
                    {stat.sentenceLengthVariance.toFixed(1)}
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace" }}>
                    {stat.typeTokenRatio.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
