export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <>
      <div className="pagehead"><div><h1>Calendar</h1><div className="sub">Open any past day&rsquo;s report and downloads</div></div></div>
      <div className="card">
        <h3>Coming next</h3>
        <p className="hint" style={{ marginTop: 8 }}>
          A month calendar with a dot on each day that has data, click-through to that day&rsquo;s saved
          dashboard and downloads. Built once daily reports are generating.
        </p>
      </div>
    </>
  );
}
