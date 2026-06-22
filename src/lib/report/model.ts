// Even Lab — shared report model. Normalizes daily/monthly metrics into one
// shape that every renderer (SVG/PNG/PDF/HTML/PPTX) consumes.
import { getDailyDashboard } from "../metrics/daily";
import { getMonthlyDashboard } from "../metrics/monthly";

export interface Kpi { label: string; value: string; note: string; sev?: "red" | "amber" | "green" }
export interface DeptRate { dept: string; t1: number | null; t2: number | null }
export interface StatusMix { dept: string; normal: number; warning: number; critical: number }
export interface Leader { dur: string; dept: string; test: string; uhid: string }
export interface ReportModel {
  scope: "day" | "month";
  key: string;            // 'YYYY-MM-DD' or 'YYYY-MM'
  title: string;
  subtitle: string;
  meta: string;
  kpis: Kpi[];
  deptRates: DeptRate[];
  statusMix: StatusMix[];
  trend?: { labels: string[]; volume: number[]; delayed: (number | null)[] };
  topTat1: Leader[];
  topTat2: Leader[];
  footer: string;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export function fmtMin(m: number | null): string {
  if (m == null) return "–";
  const h = Math.floor(m / 60), x = Math.round(m % 60);
  return h ? `${h}h ${String(x).padStart(2, "0")}m` : `${x}m`;
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const sev = (p: number | null): Kpi["sev"] => (p == null ? undefined : p >= 50 ? "red" : p >= 30 ? "amber" : "green");
function prettyDay(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function prettyMonth(m: string) { const [y, mm] = m.split("-").map(Number); return `${MONTHS[mm - 1]} ${y}`; }

const FOOTER = "Delayed = KareXpert “Critical” status. TAT 1 = collection → result entry; TAT 2 = result entry → verification. Even Hospital, Race Course Road.";

function kpis(k: any, kind: "day" | "month"): Kpi[] {
  const unit = kind === "day" ? "prev day" : "prev month";
  const t1p = pct(k.t1_crit, k.t1_flag), t2p = pct(k.t2_crit, k.t2_flag);
  return [
    { label: "Tests", value: String(k.tests), note: kind === "day" ? "in this batch" : "this month" },
    { label: "TAT 1 median", value: fmtMin(k.tat1_med), note: "collection → entry" },
    { label: "TAT 2 median", value: fmtMin(k.tat2_med), note: "entry → verification" },
    { label: "TAT 1 delayed", value: t1p == null ? "–" : `${t1p}%`, note: `${k.t1_crit} of ${k.t1_flag}`, sev: sev(t1p) },
    { label: "TAT 2 delayed", value: t2p == null ? "–" : `${t2p}%`, note: `${k.t2_crit} of ${k.t2_flag}`, sev: sev(t2p) },
  ];
}
function deptRates(rows: any[]): DeptRate[] {
  return rows.filter((d) => d.t1_flag > 0 || d.t2_flag > 0).map((d) => ({
    dept: d.department || "Unspecified",
    t1: d.t1_flag ? Math.round((d.t1_crit / d.t1_flag) * 100) : null,
    t2: d.t2_flag ? Math.round((d.t2_crit / d.t2_flag) * 100) : null,
  }));
}
function statusMix(rows: any[]): StatusMix[] {
  const p = (x: number, n: number) => (n ? +((x / n) * 100).toFixed(1) : 0);
  return rows.map((m) => ({ dept: m.department || "Unspecified", normal: p(m.normal, m.flag_n), warning: p(m.warning, m.flag_n), critical: p(m.critical, m.flag_n) }));
}
function leaders(rows: any[]): Leader[] {
  return rows.map((r) => ({ dur: fmtMin(r.minutes), dept: r.department || "", test: r.service_item || "", uhid: r.uhid || "" }));
}

export async function buildDailyModel(date?: string): Promise<ReportModel | null> {
  const d = await getDailyDashboard(date);
  if ("error" in d || !d.date || !d.kpis) return null;
  return {
    scope: "day", key: d.date, title: prettyDay(d.date),
    subtitle: "Even Hospital · Diagnostic Lab · Daily TAT report",
    meta: `${d.kpis.tests} tests`,
    kpis: kpis(d.kpis, "day"), deptRates: deptRates(d.deptRates), statusMix: statusMix(d.statusMix),
    topTat1: leaders(d.topTat1), topTat2: leaders(d.topTat2), footer: FOOTER,
  };
}

export async function buildMonthlyModel(month?: string): Promise<ReportModel | null> {
  const m = await getMonthlyDashboard(month);
  if ("error" in m || !m.month || !m.kpis) return null;
  return {
    scope: "month", key: m.month, title: prettyMonth(m.month),
    subtitle: "Even Hospital · Diagnostic Lab · Monthly BRM summary",
    meta: `${m.kpis.tests} tests`,
    kpis: kpis(m.kpis, "month"), deptRates: deptRates(m.deptRates), statusMix: statusMix(m.statusMix),
    trend: { labels: m.series.map((p) => p.date.slice(8)), volume: m.series.map((p) => p.n),
      delayed: m.series.map((p) => (p.t1_flag ? Math.round((p.t1_crit / p.t1_flag) * 100) : null)) },
    topTat1: leaders(m.topTat1), topTat2: leaders(m.topTat2), footer: FOOTER,
  };
}
