"use client";
import { useState } from "react";

export default function InsightCard({
  scope, dkey, initial,
}: { scope: "daily" | "monthly"; dkey: string; initial: string | null }) {
  const [text, setText] = useState<string | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/insight/${scope}/${dkey}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not generate insight.");
      setText(j.text);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="card ai">
      <div className="ai-head">
        <h3><span className="ai-badge">Even AI</span> {scope === "daily" ? "What to notice" : "Monthly summary"}</h3>
        {text != null && (
          <button className="ai-regen" onClick={generate} disabled={loading}>{loading ? "…" : "Regenerate"}</button>
        )}
      </div>
      {text != null ? (
        <div className="ai-text">{text}</div>
      ) : (
        <div className="ai-empty">
          <p className="hint" style={{ margin: "0 0 10px" }}>
            Generate a plain-language {scope === "daily" ? "insight for this day" : "BRM narrative for this month"} from the figures above.
          </p>
          <button className="btn sm" onClick={generate} disabled={loading}>{loading ? "Writing…" : "Generate AI insight"}</button>
        </div>
      )}
      {error && <div className="err">{error}</div>}
      <div className="ai-note">AI-generated from de-identified aggregates — no patient data is sent. Verify figures against the charts.</div>
    </div>
  );
}
