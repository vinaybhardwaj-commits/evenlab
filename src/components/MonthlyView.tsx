"use client";
import { useRouter } from "next/navigation";
import type { MonthlyDashboard } from "@/lib/metrics/monthly";
import type { MonthCount } from "@/lib/metrics/calendar";
import { DelayRateChart, StatusMixChart, TrendChart } from "./charts";

type Data = MonthlyDashboard | { error: string };

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmt(m: number | null): string {
  if (m == null) return "–";
  const h = Math.floor(m / 60), x = Math.round(m % 60);
  return h ? `${h}h ${String(x).padStart(2, "0")}m` : `${x}m`;
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const sevClass = (p: number | null) => (p == null ? "" : p >= 50 ? "red" : p >= 30 ? "amber" : "green");
function prettyMonth(mm: string): string { const [y, m] = mm.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; }

export default function MonthlyView({ data, months }: { data: Data; months: MonthCount[] }) {
  const router = useRouter();

  if ("error" in data) {
    return (<>
      <div className="pagehead"><div><h1>Monthly summaries</h1><div className="sub">BRM-ready overview</div></div></div>
      <div className="card"><h3>Database not connected</h3><p className="hint" style={{ marginTop: 8 }}>{data.error}</p></div>
    </>);
  }
  if (!data.month || !data.kpis) {
    return (<>
      <div className="pagehead"><div><h1>Monthly summaries</h1><div className="sub">BRM-ready overview</div></div></div>
      <div className="empty"><h2>No data yet</h2><p>Upload data and the monthly summary will appear here.</p></div>
    </>);
  }

  const k = data.kpis, pk = data.prevKpis;
  const t1p = pct(k.t1_crit, k.t1_flag), t2p = pct(k.t2_crit, k.t2_flag);
  const delta = (cur: number | null, prev: number | null, unit: "min" | "pct") => {
    if (cur == null || prev == null) return null;
    const d = Math.round(cur - prev);
    if (d === 0) return "no change vs prev month";
    return `${d > 0 ? "▲" : "▼"} ${Math.abs(d)}${unit === "min" ? "m" : " pts"} vs prev month`;
  };
  const pt1 = pk ? pct(pk.t1_crit, pk.t1_flag) : null;
  const pt2 = pk ? pct(pk.t2_crit, pk.t2_flag) : null;

  const rated = data.deptRates.filter((d) => d.t1_flag > 0 || d.t2_flag > 0);
  const drLabels = rated.map((d) => d.department || "Unspecified");
  const drT1 = rated.map((d) => (d.t1_flag ? Math.round((d.t1_crit / d.t1_flag) * 100) : null));
  const drT2 = rated.map((d) => (d.t2_flag ? Math.round((d.t2_crit / d.t2_flag) * 100) : null));

  const mix = data.statusMix;
  const toPct = (x: number, n: number) => (n ? +((x / n) * 100).toFixed(1) : 0);
  const mxLabels = mix.map((m) => m.department || "Unspecified");
  const mxN = mix.map((m) => toPct(m.normal, m.flag_n));
  const mxW = mix.map((m) => toPct(m.warning, m.flag_n));
  const mxC = mix.map((m) => toPct(m.critical, m.flag_n));

  const sLabels = data.series.map((p) => p.date.slice(8)); // day-of-month
  const sVol = data.series.map((p) => p.n);
  const sPct = data.series.map((p) => (p.t1_flag ? Math.round((p.t1_crit / p.t1_flag) * 100) : null));

  return (
    <>
      <div className="pagehead">
        <div><h1>Monthly summary · {prettyMonth(data.month)}</h1><div className="sub">{k.tests} tests</div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="monthsel" value={data.month}
            onChange={(e) => router.push(`/monthly?month=${e.target.value}`)}>
            {months.map((m) => <option key={m.month} value={m.month}>{prettyMonth(m.month)} ({m.count})</option>)}
          </select>
          <button className="btn sm" disabled title="Coming in the next phase">Download deck</button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lab">Tests</div><div className="val">{k.tests}</div>{pk && <div className="trend">vs {pk.tests} prev month</div>}</div>
        <div className="kpi"><div className="lab">TAT 1 median</div><div className="val">{fmt(k.tat1_med)}</div><div className="trend">{delta(k.tat1_med, pk?.tat1_med ?? null, "min") ?? "collection → entry"}</div></div>
        <div className="kpi"><div className="lab">TAT 2 median</div><div className="val">{fmt(k.tat2_med)}</div><div className="trend">{delta(k.tat2_med, pk?.tat2_med ?? null, "min") ?? "entry → verification"}</div></div>
        <div className={`kpi ${sevClass(t1p)}`}><div className="lab">TAT 1 delayed</div><div className="val">{t1p == null ? "–" : `${t1p}%`}</div><div className="trend">{delta(t1p, pt1, "pct") ?? `${k.t1_crit} of ${k.t1_flag}`}</div></div>
        <div className={`kpi ${sevClass(t2p)}`}><div className="lab">TAT 2 delayed</div><div className="val">{t2p == null ? "–" : `${t2p}%`}</div><div className="trend">{delta(t2p, pt2, "pct") ?? `${k.t2_crit} of ${k.t2_flag}`}</div></div>
      </div>

      <div className="card">
        <h3>Through the month — volume &amp; delayed rate</h3>
        <p className="hint">tests per day (area) and TAT 1 delayed % (line)</p>
        <div className="chartbox">{data.series.length ? <TrendChart labels={sLabels} volume={sVol} delayedPct={sPct} /> : <p className="hint">No daily data.</p>}</div>
      </div>

      <div className="grid3">
        <div className="card">
          <h3>Delayed-test rate by department</h3>
          <p className="hint">% flagged Critical by KareXpert</p>
          <div className="chartbox">{drLabels.length ? <DelayRateChart labels={drLabels} tat1={drT1} tat2={drT2} /> : <p className="hint">No flagged tests.</p>}</div>
        </div>
        <div className="card">
          <h3>Status mix — collection → entry</h3>
          <p className="hint">on-time / borderline / delayed</p>
          <div className="chartbox">{mxLabels.length ? <StatusMixChart labels={mxLabels} normal={mxN} warning={mxW} critical={mxC} /> : <p className="hint">No flagged tests.</p>}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card"><h3>Slowest TAT 1 (collection → entry)</h3><Leader rows={data.topTat1} /></div>
        <div className="card"><h3>Slowest TAT 2 (entry → verification)</h3><Leader rows={data.topTat2} /></div>
      </div>
    </>
  );
}

function Leader({ rows }: { rows: MonthlyDashboard["topTat1"] }) {
  if (!rows.length) return <p className="hint">No delayed tests this month.</p>;
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
