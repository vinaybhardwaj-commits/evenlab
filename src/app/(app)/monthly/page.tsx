export const dynamic = "force-dynamic";

export default function MonthlyPage() {
  return (
    <>
      <div className="pagehead"><div><h1>Monthly summaries</h1><div className="sub">BRM-ready decks</div></div></div>
      <div className="card">
        <h3>Coming next</h3>
        <p className="hint" style={{ marginTop: 8 }}>
          Auto-built PowerPoint deck at month-end (plus a &ldquo;Generate now&rdquo; button) with AI synthesis
          and trend/forecast commentary, saved to this archive. Built after the daily reports phase.
        </p>
      </div>
    </>
  );
}
