"use client";
import { useState } from "react";
import type { DailyDashboard } from "@/lib/metrics/daily";
import { DelayRateChart, StatusMixChart } from "./charts";
import UploadModal from "./UploadModal";

type Data = DailyDashboard | { error: string };

function fmt(m: number | null): string {
  if (m == null) return "–";
  const h = Math.floor(m / 60), x = Math.round(m % 60);
  return h ? `${h}h ${String(x).padStart(2, "0")}m` : `${x}m`;
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const sevClass = (p: number | null) => (p == null ? "" : p >= 50 ? "red" : p >= 30 ? "amber" : "green");
function prettyDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function TodayView({ data, selectedDate }: { data: Data; selectedDate?: string | null }) {
  const [showUpload, setShowUpload] = useState(false);
  const isHistorical = !!selectedDate;
  const UploadBtn = (
    <button className="btn" onClick={() => setShowUpload(true)}>Upload today&rsquo;s CSV</button>
  );

  // DB not configured / query error
  if ("error" in data) {
    return (
      <>
        <div className="pagehead"><div><h1>Today</h1><div className="sub">Daily lab turnaround</div></div>{UploadBtn}</div>
        <div className="card"><h3>Database not connected yet</h3>
          <p className="hint" style={{ marginTop: 8 }}>
            Set <code>DATABASE_URL</code> and run <code>db/schema.sql</code> to go live. You can still upload —
            the file is parsed and validated, but committing needs the database.
          </p>
          <p className="hint" style={{ color: "#9aa3b2" }}>{data.error}</p>
        </div>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      </>
    );
  }

  // No data yet
  if (!data.date || !data.kpis) {
    return (
      <>
        <div className="pagehead"><div><h1>Today</h1><div className="sub">Daily lab turnaround</div></div>{UploadBtn}</div>
        <div className="empty">
          <h2>No data yet</h2>
          <p>Upload today&rsquo;s KareXpert TAT export and your dashboard, with charts and reports, will appear here.</p>
          {UploadBtn}
        </div>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      </>
    );
  }

  const k = data.kpis, pk = data.prevKpis;
  const t1p = pct(k.t1_crit, k.t1_flag), t2p = pct(k.t2_crit, k.t2_flag);

  const rated = data.deptRates.filter((d) => d.t1_flag > 0 || d.t2_flag > 0);
  const drLabels = rated.map((d) => d.department || "Unspecified");
  const drT1 = rated.map((d) => (d.t1_flag ? Math.round((d.t1_crit / d.t1_flag) * 100) : null));
  const drT2 = rated.map((d) => (d.t2_flag ? Math.round((d.t2_crit / d.t2_flag) * 100) : null));

  const mix = data.statusMix;
  const mxLabels = mix.map((m) => m.department || "Unspecified");
  const toPct = (x: number, n: number) => (n ? +((x / n) * 100).toFixed(1) : 0);
  const mxN = mix.map((m) => toPct(m.normal, m.flag_n));
  const mxW = mix.map((m) => toPct(m.warning, m.flag_n));
  const mxC = mix.map((m) => toPct(m.critical, m.flag_n));

  const delta = (cur: number | null, prev: number | null, unit: "min" | "pct") => {
    if (cur == null || prev == null) return null;
    const d = Math.round(cur - prev);
    if (d === 0) return "no change vs prev day";
    return `${d > 0 ? "▲" : "▼"} ${Math.abs(d)}${unit === "min" ? "m" : " pts"} vs prev day`;
  };
  const pt1 = pk ? pct(pk.t1_crit, pk.t1_flag) : null;
  const pt2 = pk ? pct(pk.t2_crit, pk.t2_flag) : null;

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{isHistorical ? prettyDate(data.date) : `Today · ${prettyDate(data.date)}`}</h1>
          <div className="sub">
            {k.tests} tests{isHistorical ? " · " : " in this batch"}
            {isHistorical && <a className="link" href="/today">← back to latest</a>}
          </div>
        </div>
        {UploadBtn}
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lab">Tests</div><div className="val">{k.tests}</div>
          {pk && <div className="trend">vs {pk.tests} prev day</div>}</div>
        <div className="kpi"><div className="lab">TAT 1 median</div><div className="val">{fmt(k.tat1_med)}</div>
          <div className="trend">{delta(k.tat1_med, pk?.tat1_med ?? null, "min") ?? "collection → entry"}</div></div>
        <div className="kpi"><div className="lab">TAT 2 median</div><div className="val">{fmt(k.tat2_med)}</div>
          <div className="trend">{delta(k.tat2_med, pk?.tat2_med ?? null, "min") ?? "entry → verification"}</div></div>
        <div className={`kpi ${sevClass(t1p)}`}><div className="lab">TAT 1 delayed</div>
          <div className="val">{t1p == null ? "–" : `${t1p}%`}</div>
          <div className="trend">{delta(t1p, pt1, "pct") ?? `${k.t1_crit} of ${k.t1_flag}`}</div></div>
        <div className={`kpi ${sevClass(t2p)}`}><div className="lab">TAT 2 delayed</div>
          <div className="val">{t2p == null ? "–" : `${t2p}%`}</div>
          <div className="trend">{delta(t2p, pt2, "pct") ?? `${k.t2_crit} of ${k.t2_flag}`}</div></div>
      </div>

      <div className="card">
        <h3>Downloads</h3>
        <p className="hint">Generated on demand and saved. Exports show UHID only — never patient names.</p>
        <div className="downloads">
          <a className="dl" href={`/api/report/daily/${data.date}/pdf`}><div><div className="t">PDF report</div><div className="s">download .pdf</div></div></a>
          <a className="dl" href={`/api/report/daily/${data.date}/png`}><div><div className="t">Shareable image</div><div className="s">download .png</div></div></a>
          <a className="dl" href={`/api/report/daily/${data.date}/html`} target="_blank" rel="noopener noreferrer"><div><div className="t">Interactive view</div><div className="s">open .html</div></div></a>
        </div>
      </div>

      <div className="grid3">
        <div className="card">
          <h3>Delayed-test rate by department</h3>
          <p className="hint">% flagged Critical by KareXpert</p>
          <div className="chartbox">
            {drLabels.length ? <DelayRateChart labels={drLabels} tat1={drT1} tat2={drT2} />
              : <p className="hint">No flagged tests for this day.</p>}
          </div>
        </div>
        <div className="card">
          <h3>Status mix — collection → entry</h3>
          <p className="hint">on-time / borderline / delayed</p>
          <div className="chartbox">
            {mxLabels.length ? <StatusMixChart labels={mxLabels} normal={mxN} warning={mxW} critical={mxC} />
              : <p className="hint">No flagged tests for this day.</p>}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Slowest TAT 1 (collection → entry)</h3>
          <Leader rows={data.topTat1} />
        </div>
        <div className="card">
          <h3>Slowest TAT 2 (entry → verification)</h3>
          <Leader rows={data.topTat2} />
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </>
  );
}

function Leader({ rows }: { rows: DailyDashboard["topTat1"] }) {
  if (!rows.length) return <p className="hint">No delayed tests for this day.</p>;
  return (
    <table>
      <thead><tr><th>Duration</th><th>Dept</th><th>Test</th><th>UHID</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="dur">{fmt(r.minutes)}</td>
            <td>{r.department}</td>
            <td>{r.service_item}</td>
            <td>{r.uhid}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
