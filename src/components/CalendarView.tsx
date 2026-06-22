"use client";
import Link from "next/link";
import type { DayCount } from "@/lib/metrics/calendar";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["S","M","T","W","T","F","S"];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarView({
  month, days, error,
}: { month: string; days: DayCount[]; error?: string }) {
  if (error) {
    return (
      <>
        <div className="pagehead"><div><h1>Calendar</h1><div className="sub">Browse any day&rsquo;s report</div></div></div>
        <div className="card"><h3>Database not connected</h3><p className="hint" style={{ marginTop: 8 }}>{error}</p></div>
      </>
    );
  }
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const counts: Record<string, number> = {};
  for (const d of days) counts[d.date] = d.count;
  const total = days.reduce((s, d) => s + d.count, 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <div className="pagehead">
        <div><h1>Calendar</h1><div className="sub">Click any day with data to open its report</div></div>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Link className="btn ghost sm" href={`/calendar?month=${shiftMonth(month, -1)}`}>← Prev</Link>
          <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 16 }}>
            {MONTHS[m - 1]} {y} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13 }}>· {total} tests</span>
          </div>
          <Link className="btn ghost sm" href={`/calendar?month=${shiftMonth(month, 1)}`}>Next →</Link>
        </div>
        <div className="cal-grid">
          {DOW.map((d, i) => <div key={"h" + i} className="cal-dow">{d}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div key={"e" + i} className="cal-day empty" />;
            const dateStr = `${month}-${String(d).padStart(2, "0")}`;
            const c = counts[dateStr] ?? 0;
            if (!c) return <div key={i} className="cal-day none"><span className="n">{d}</span></div>;
            return (
              <Link key={i} href={`/today?date=${dateStr}`} className="cal-day has">
                <span className="n">{d}</span>
                <span className="c">{c} tests</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
