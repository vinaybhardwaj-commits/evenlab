"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Summary {
  rowsInFile: number; uniqueTests: number; duplicatesMerged: number;
  droppedNoId: number; dateRangeStart: string | null; dateRangeEnd: string | null;
}

type Step = "pick" | "review" | "done";

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  async function preview(f: File) {
    setBusy(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/ingest/preview", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not read file.");
      setFile(f); setSummary(j.summary); setStep("review");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/ingest/commit", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Import failed.");
      setResult({ inserted: j.inserted, updated: j.updated }); setStep("done");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function finish() { onClose(); router.refresh(); }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>

        {step === "pick" && (
          <>
            <h2>Upload today&rsquo;s KareXpert CSV</h2>
            <p className="hint" style={{ margin: "4px 0 0" }}>We&rsquo;ll check it before saving.</p>
            <div className="drop" onClick={() => fileRef.current?.click()}>
              <b style={{ color: "var(--navy)" }}>{busy ? "Reading…" : "Click to choose a CSV"}</b>
              <div style={{ fontSize: 12, marginTop: 6 }}>lab_service_tat_report…csv</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) preview(f); }} />
            {error && <div className="err">{error}</div>}
          </>
        )}

        {step === "review" && summary && (
          <>
            <h2>Check before importing</h2>
            <p className="hint" style={{ margin: "4px 0 12px" }}>{file?.name}</p>
            <div className="valrow"><span>Rows in file</span><b>{summary.rowsInFile}</b></div>
            <div className="valrow"><span>Unique tests</span><b>{summary.uniqueTests}</b></div>
            <div className="valrow"><span>Date range</span><b>{summary.dateRangeStart} → {summary.dateRangeEnd}</b></div>
            <div className="valrow"><span>Duplicates merged</span><b>{summary.duplicatesMerged}</b></div>
            <div className="valrow"><span>Dropped (no id)</span><b>{summary.droppedNoId}</b></div>
            {error && <div className="err">{error}</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn" onClick={commit} disabled={busy}>{busy ? "Importing…" : "Import & build report"}</button>
            </div>
          </>
        )}

        {step === "done" && result && (
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <h2 style={{ textAlign: "center" }}>Import complete</h2>
            <p className="hint" style={{ textAlign: "center", marginBottom: 18 }}>
              {result.inserted} new · {result.updated} updated. Dashboard refreshed.
            </p>
            <button className="btn" style={{ margin: "0 auto" }} onClick={finish}>View dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
