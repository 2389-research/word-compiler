import React, { useState, useCallback, useRef } from "react";
import type { AppAction } from "../hooks/useProject.js";
import { buildBootstrapPrompt, parseBootstrapResponse, bootstrapToBible } from "../../bootstrap/index.js";
import { generateStream } from "../../llm/client.js";

interface Props {
  open: boolean;
  dispatch: React.Dispatch<AppAction>;
}

export function BootstrapModal({ open, dispatch }: Props) {
  const [synopsis, setSynopsis] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [streamText, setStreamText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleClose = useCallback(() => {
    dispatch({ type: "SET_BOOTSTRAP_OPEN", value: false });
    setError(null);
    setStatus("");
    setStreamText("");
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [dispatch]);

  const handleBootstrap = useCallback(async () => {
    if (!synopsis.trim()) return;

    setLoading(true);
    setError(null);
    setStreamText("");
    setElapsed(0);

    const started = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    try {
      setStatus("Building prompt...");
      const payload = buildBootstrapPrompt(synopsis);

      setStatus("Streaming from LLM...");
      let fullText = "";

      await generateStream(payload, {
        onToken: (text) => {
          fullText += text;
          setStreamText(fullText);
        },
        onDone: () => {
          setStatus("Parsing response...");
        },
        onError: (err) => {
          throw new Error(err);
        },
      });

      const parsed = parseBootstrapResponse(fullText);
      if ("error" in parsed) {
        setError(`Parse failed: ${parsed.error}\n\nRaw response:\n${fullText.slice(0, 500)}`);
        setLoading(false);
        setStatus("");
        return;
      }

      const bible = bootstrapToBible(parsed, `proj-${Date.now()}`);
      setStatus("Done!");
      dispatch({ type: "SET_BIBLE", bible });

      setTimeout(() => {
        dispatch({ type: "SET_BOOTSTRAP_OPEN", value: false });
        setLoading(false);
        setStatus("");
        setStreamText("");
        setElapsed(0);
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap failed");
      setLoading(false);
      setStatus("");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [synopsis, dispatch]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Bootstrap Bible from Synopsis</div>
        <div className="modal-body">
          <p style={{ marginBottom: "12px", color: "var(--text-secondary)", fontSize: "12px" }}>
            Paste your story synopsis. The system will extract characters, locations, tone, and a
            suggested kill list. You'll need to add dialogue samples manually.
          </p>

          {!loading ? (
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder={`Example synopsis — replace with your own:\n\nMarcus Cole, a retired homicide detective turned bar owner, runs a dimly lit jazz bar called "The Velvet" in a decaying waterfront district. He speaks in clipped, world-weary sentences and never uses metaphors — he says what he means. His bartender Elena Voss is a sharp-tongued grad student working nights to pay tuition; she speaks in long, winding sentences full of literary references that annoy Marcus.\n\nOne rainy Tuesday, a woman named Claire Fontaine walks in asking about a man who died in the bar six months ago — a death ruled accidental that Marcus has always suspected was murder. Claire claims to be the dead man's sister, but Marcus notices she never says his name.\n\nThe story is close-third POV through Marcus. The prose should feel like late-period Raymond Carver crossed with Dennis Lehane — spare, muscular sentences with sudden moments of surprising tenderness. No flowery language. No adverbs modifying dialogue tags. The bar smells like old wood, spilled bourbon, and rain. The jukebox plays Coltrane.\n\nThe scene takes place entirely inside the bar over about 45 minutes of story time. The tension is in what isn't said — Claire is testing Marcus and Marcus knows it, but he plays along because he wants answers too.`}
            />
          ) : (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                padding: "8px",
                height: "300px",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--text-primary)",
              }}
            >
              {streamText || "Waiting for first token..."}
            </div>
          )}

          {loading && (
            <div style={{
              marginTop: "8px",
              padding: "6px 10px",
              background: "var(--bg-tertiary)",
              borderRadius: "4px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <span className="spinner" style={{ width: "10px", height: "10px" }} />
              <span style={{ color: "var(--text-primary)" }}>{status}</span>
              <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>
                {elapsed}s · {streamText.length} chars
              </span>
            </div>
          )}

          {error && <div className="error-banner" style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button onClick={handleClose}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={handleBootstrap}
            disabled={loading || !synopsis.trim()}
          >
            {loading ? "Bootstrapping..." : "Bootstrap Bible"}
          </button>
        </div>
      </div>
    </div>
  );
}
