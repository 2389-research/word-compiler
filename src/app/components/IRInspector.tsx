import type { CharacterDelta, NarrativeIR } from "../../types/index.js";

interface Props {
  ir: NarrativeIR | null;
  sceneTitle: string;
  isExtracting: boolean;
  canExtract: boolean;
  onExtract: () => void;
  onVerify: () => void;
  onUpdate: (ir: NarrativeIR) => void;
  onClose: () => void;
}

function IRBadge({ ir }: { ir: NarrativeIR | null }) {
  if (!ir) return <span className="badge">No IR</span>;
  if (ir.verified) return <span className="badge badge-accepted">Verified</span>;
  return <span className="badge badge-warning">Unverified</span>;
}

function DeltaCard({ delta }: { delta: CharacterDelta }) {
  const hasData = delta.learned || delta.suspicionGained || delta.emotionalShift || delta.relationshipChange;
  if (!hasData) return null;

  return (
    <div style={{ border: "1px solid #333", borderRadius: 4, padding: "8px 12px", marginBottom: 8 }}>
      <strong style={{ fontSize: "0.85em", opacity: 0.7 }}>{delta.characterId}</strong>
      {delta.learned && (
        <div style={{ marginTop: 4 }}>
          <span style={{ opacity: 0.6, fontSize: "0.8em" }}>LEARNED: </span>
          {delta.learned}
        </div>
      )}
      {delta.suspicionGained && (
        <div style={{ marginTop: 4 }}>
          <span style={{ opacity: 0.6, fontSize: "0.8em" }}>SUSPECTS: </span>
          {delta.suspicionGained}
        </div>
      )}
      {delta.emotionalShift && (
        <div style={{ marginTop: 4 }}>
          <span style={{ opacity: 0.6, fontSize: "0.8em" }}>EMOTIONAL: </span>
          {delta.emotionalShift}
        </div>
      )}
      {delta.relationshipChange && (
        <div style={{ marginTop: 4 }}>
          <span style={{ opacity: 0.6, fontSize: "0.8em" }}>RELATIONSHIP: </span>
          {delta.relationshipChange}
        </div>
      )}
    </div>
  );
}

export function IRInspector({
  ir,
  sceneTitle,
  isExtracting,
  canExtract,
  onExtract,
  onVerify,
  onUpdate,
  onClose,
}: Props) {
  return (
    <div className="pane" style={{ maxHeight: "80vh", overflowY: "auto" }}>
      <div className="pane-header">
        <span>IR Inspector — {sceneTitle}</span>
        <div className="pane-actions">
          <IRBadge ir={ir} />
          <button onClick={onExtract} disabled={!canExtract || isExtracting}>
            {isExtracting ? "Extracting..." : ir ? "Re-extract" : "Extract IR"}
          </button>
          {ir && !ir.verified && (
            <button className="primary" onClick={onVerify}>
              Verify
            </button>
          )}
          <button onClick={onClose}>✕</button>
        </div>
      </div>

      {!ir && (
        <div style={{ padding: 24, opacity: 0.6, textAlign: "center" }}>
          No IR extracted yet. Complete the scene and click "Extract IR" to analyze.
        </div>
      )}

      {ir && (
        <div style={{ padding: 16 }}>
          {/* Events */}
          <section>
            <h4 style={{ margin: "0 0 8px", opacity: 0.7 }}>Events ({ir.events.length})</h4>
            {ir.events.length === 0 ? (
              <p style={{ opacity: 0.4 }}>None recorded</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {ir.events.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Facts Introduced */}
          <section style={{ marginTop: 16 }}>
            <h4 style={{ margin: "0 0 8px", opacity: 0.7 }}>
              Facts Introduced ({ir.factsIntroduced.length}) •{" "}
              <span style={{ opacity: 0.5 }}>Revealed to Reader: {ir.factsRevealedToReader.length}</span>
            </h4>
            {ir.factsIntroduced.length === 0 ? (
              <p style={{ opacity: 0.4 }}>None</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {ir.factsIntroduced.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Character Deltas */}
          <section style={{ marginTop: 16 }}>
            <h4 style={{ margin: "0 0 8px", opacity: 0.7 }}>Character Deltas ({ir.characterDeltas.length})</h4>
            {ir.characterDeltas.length === 0 ? (
              <p style={{ opacity: 0.4 }}>No character changes recorded</p>
            ) : (
              ir.characterDeltas.map((d, i) => <DeltaCard key={i} delta={d} />)
            )}
          </section>

          {/* Setups / Payoffs */}
          <section style={{ marginTop: 16 }}>
            <h4 style={{ margin: "0 0 8px", opacity: 0.7 }}>
              Setups Planted{" "}
              <span className={`badge ${ir.setupsPlanted.length > 0 ? "badge-accepted" : ""}`}>
                {ir.setupsPlanted.length}
              </span>
              {" • "}
              Payoffs Executed{" "}
              <span className={`badge ${ir.payoffsExecuted.length > 0 ? "badge-accepted" : ""}`}>
                {ir.payoffsExecuted.length}
              </span>
            </h4>
            {ir.setupsPlanted.map((s, i) => (
              <div key={i} style={{ fontSize: "0.9em" }}>
                ↑ {s}
              </div>
            ))}
            {ir.payoffsExecuted.map((p, i) => (
              <div key={i} style={{ fontSize: "0.9em" }}>
                ✓ {p}
              </div>
            ))}
          </section>

          {/* Unresolved Tensions */}
          {ir.unresolvedTensions.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 8px", opacity: 0.7 }}>Unresolved Tensions ({ir.unresolvedTensions.length})</h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {ir.unresolvedTensions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Facts Withheld */}
          {ir.factsWithheld.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 8px", opacity: 0.7 }}>
                Facts Withheld from Reader ({ir.factsWithheld.length})
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {ir.factsWithheld.map((f, i) => (
                  <li key={i} style={{ opacity: 0.6 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
