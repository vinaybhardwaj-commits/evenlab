// Even Lab — AI insights. Builds DE-IDENTIFIED stat payloads (no UHID, no names,
// no addresses) and asks Gemini to phrase them. Numbers always come from the
// deterministic metrics engine; the model only writes prose. Results cached.
import { getDailyDashboard } from "../metrics/daily";
import { getMonthlyDashboard } from "../metrics/monthly";
import { generateText, modelName } from "./vertex";
import { getPool } from "../db/client";

const r0 = (x: number | null) => (x == null ? null : Math.round(x));
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

const DAILY_SYS =
  "You are a hospital laboratory operations analyst writing for the Lab Director. " +
  "From the JSON metrics provided, write a concise 'what to notice today' insight: 2–4 short sentences, plain language, " +
  "lead with the single most actionable point. Use ONLY the numbers given — never invent or estimate figures. " +
  "Refer to departments and tests, never to individual patients. No headings, no bullet points.";

const MONTHLY_SYS =
  "You are a hospital laboratory operations analyst preparing a Business Review Meeting summary for the Lab Director. " +
  "From the JSON metrics provided, write: (1) a short narrative paragraph (3–5 sentences) on the month's TAT performance and what changed vs the previous month; " +
  "then (2) 3–5 bullet talking points (each one line, prefixed with '• '); then (3) one line beginning 'Watch:' giving a brief, clearly-tentative trend/forecast note. " +
  "Use ONLY the numbers given — never invent figures. Departments and tests only, never individual patients.";

function deidDaily(d: any) {
  return {
    date: d.date, tests: d.kpis.tests,
    tat1_median_min: r0(d.kpis.tat1_med), tat2_median_min: r0(d.kpis.tat2_med),
    tat1_delayed: { critical: d.kpis.t1_crit, flagged: d.kpis.t1_flag, pct: pctOf(d.kpis.t1_crit, d.kpis.t1_flag) },
    tat2_delayed: { critical: d.kpis.t2_crit, flagged: d.kpis.t2_flag, pct: pctOf(d.kpis.t2_crit, d.kpis.t2_flag) },
    dept_delayed_pct: d.deptRates.map((x: any) => ({ dept: x.department, tat1: pctOf(x.t1_crit, x.t1_flag), tat2: pctOf(x.t2_crit, x.t2_flag), n: x.n })),
    slowest_tat1_min: d.topTat1.slice(0, 5).map((x: any) => ({ dept: x.department, test: x.service_item, min: r0(x.minutes) })),
    slowest_tat2_min: d.topTat2.slice(0, 5).map((x: any) => ({ dept: x.department, test: x.service_item, min: r0(x.minutes) })),
  };
}

function deidMonthly(m: any) {
  const k = m.kpis, pk = m.prevKpis;
  const series = m.series ?? [];
  const worst = [...series].filter((s: any) => s.t1_flag).sort((a: any, b: any) => (b.t1_crit / b.t1_flag) - (a.t1_crit / a.t1_flag))[0];
  return {
    month: m.month, tests: k.tests,
    tat1_median_min: r0(k.tat1_med), tat2_median_min: r0(k.tat2_med),
    tat1_delayed_pct: pctOf(k.t1_crit, k.t1_flag), tat2_delayed_pct: pctOf(k.t2_crit, k.t2_flag),
    prev_month: pk ? { tests: pk.tests, tat1_median_min: r0(pk.tat1_med), tat2_median_min: r0(pk.tat2_med), tat1_delayed_pct: pctOf(pk.t1_crit, pk.t1_flag), tat2_delayed_pct: pctOf(pk.t2_crit, pk.t2_flag) } : null,
    dept_delayed_pct: m.deptRates.map((x: any) => ({ dept: x.department, tat1: pctOf(x.t1_crit, x.t1_flag), tat2: pctOf(x.t2_crit, x.t2_flag), n: x.n })),
    days_count: series.length,
    worst_day: worst ? { date: worst.date, delayed_pct: pctOf(worst.t1_crit, worst.t1_flag) } : null,
    slowest_tat2_min: m.topTat2.slice(0, 5).map((x: any) => ({ dept: x.department, test: x.service_item, min: r0(x.minutes) })),
  };
}

async function cacheGet(scope: "day" | "month", key: string): Promise<string | null> {
  try {
    const { rows } = await getPool().query<{ text: string }>(`SELECT text FROM ai_insights WHERE scope=$1 AND key=$2`, [scope, key]);
    return rows[0]?.text ?? null;
  } catch { return null; }
}
async function cacheSet(scope: "day" | "month", key: string, text: string) {
  await getPool().query(
    `INSERT INTO ai_insights (scope, key, text, model) VALUES ($1,$2,$3,$4)
     ON CONFLICT (scope, key) DO UPDATE SET text=EXCLUDED.text, model=EXCLUDED.model, created_at=now()`,
    [scope, key, text, modelName()],
  ).catch(() => {});
}

export async function getCachedInsight(scope: "day" | "month", key: string): Promise<string | null> {
  return cacheGet(scope, key);
}

export async function generateDailyInsight(date: string): Promise<string> {
  const d = await getDailyDashboard(date);
  if ("error" in d || !d.date || !d.kpis) throw new Error("No data for this date.");
  const text = await generateText(DAILY_SYS, "Lab TAT metrics (JSON):\n" + JSON.stringify(deidDaily(d)), 2048);
  await cacheSet("day", d.date, text);
  return text;
}

export async function generateMonthlyInsight(month: string): Promise<string> {
  const m = await getMonthlyDashboard(month);
  if ("error" in m || !m.month || !m.kpis) throw new Error("No data for this month.");
  const text = await generateText(MONTHLY_SYS, "Lab TAT metrics (JSON):\n" + JSON.stringify(deidMonthly(m)), 4096);
  await cacheSet("month", m.month, text);
  return text;
}
