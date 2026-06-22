// Even Lab — monthly (BRM) dashboard metrics: aggregated over a calendar month,
// plus a within-month daily series and previous-month comparison.
import type { Pool } from "pg";
import { getPool } from "../db/client";
import type { DayKpis, DeptRate, StatusMix, LeaderRow } from "./daily";

const T1 = "Collected-Result Entered";
const T2 = "Result Entered-Result Verified";
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface DaySeriesPoint { date: string; n: number; tat1_med: number | null; t1_crit: number; t1_flag: number; }
export interface MonthlyDashboard {
  month: string;                 // 'YYYY-MM'
  prevMonth: string | null;
  kpis: DayKpis | null;
  prevKpis: DayKpis | null;
  deptRates: DeptRate[];
  statusMix: StatusMix[];
  topTat1: LeaderRow[];
  topTat2: LeaderRow[];
  series: DaySeriesPoint[];
}

// KPIs over a half-open [start, end) date range.
async function rangeKpis(pool: Pool, start: string, end: string): Promise<DayKpis> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS tests,
       percentile_cont(0.5) within group (order by tat1_min)
         filter (where tat1_min is not null and tat1_min >= 0) AS tat1_med,
       percentile_cont(0.5) within group (order by tat2_min)
         filter (where tat2_min is not null and tat2_min >= 0) AS tat2_med,
       count(*) filter (where (kx_status_json->>$3) is not null)::int AS t1_flag,
       count(*) filter (where (kx_status_json->>$3) = 'Critical')::int AS t1_crit,
       count(*) filter (where (kx_status_json->>$4) is not null)::int AS t2_flag,
       count(*) filter (where (kx_status_json->>$4) = 'Critical')::int AS t2_crit
     FROM tests WHERE report_date >= $1::date AND report_date < $2::date`,
    [start, end, T1, T2],
  );
  const r = rows[0] ?? {};
  return {
    tests: r.tests ?? 0, tat1_med: num(r.tat1_med), tat2_med: num(r.tat2_med),
    t1_flag: r.t1_flag ?? 0, t1_crit: r.t1_crit ?? 0, t2_flag: r.t2_flag ?? 0, t2_crit: r.t2_crit ?? 0,
  };
}

export async function getMonthlyDashboard(monthArg?: string): Promise<MonthlyDashboard | { error: string }> {
  let pool: Pool;
  try { pool = getPool(); } catch (e) { return { error: (e as Error).message }; }
  try {
    const month = monthArg
      ?? (await pool.query<{ m: string }>(`SELECT to_char(max(report_date),'YYYY-MM') AS m FROM tests`)).rows[0]?.m
      ?? null;
    if (!month) {
      return { month: "", prevMonth: null, kpis: null, prevKpis: null, deptRates: [], statusMix: [], topTat1: [], topTat2: [], series: [] };
    }
    const start = `${month}-01`;
    const end = (await pool.query<{ d: string }>(`SELECT to_char(($1::date + INTERVAL '1 month'),'YYYY-MM-DD') AS d`, [start])).rows[0].d;
    const prevStart = (await pool.query<{ d: string }>(`SELECT to_char(($1::date - INTERVAL '1 month'),'YYYY-MM-DD') AS d`, [start])).rows[0].d;
    const prevMonth = prevStart.slice(0, 7);
    const prevHas = (await pool.query<{ n: number }>(`SELECT count(*)::int n FROM tests WHERE report_date >= $1::date AND report_date < $2::date`, [prevStart, start])).rows[0].n;

    const [kpis, prevKpis, deptRates, statusMix, topTat1, topTat2, series] = await Promise.all([
      rangeKpis(pool, start, end),
      prevHas > 0 ? rangeKpis(pool, prevStart, start) : Promise.resolve(null),
      pool.query(
        `SELECT department, count(*)::int AS n,
           count(*) filter (where (kx_status_json->>$3)='Critical')::int AS t1_crit,
           count(*) filter (where (kx_status_json->>$3) is not null)::int AS t1_flag,
           count(*) filter (where (kx_status_json->>$4)='Critical')::int AS t2_crit,
           count(*) filter (where (kx_status_json->>$4) is not null)::int AS t2_flag
         FROM tests WHERE report_date >= $1::date AND report_date < $2::date
         GROUP BY department ORDER BY n DESC`,
        [start, end, T1, T2],
      ).then((r) => r.rows as DeptRate[]),
      pool.query(
        `SELECT department,
           count(*) filter (where (kx_status_json->>$3)='Normal')::int AS normal,
           count(*) filter (where (kx_status_json->>$3)='Warning')::int AS warning,
           count(*) filter (where (kx_status_json->>$3)='Critical')::int AS critical,
           count(*) filter (where (kx_status_json->>$3) is not null)::int AS flag_n
         FROM tests WHERE report_date >= $1::date AND report_date < $2::date
         GROUP BY department HAVING count(*) filter (where (kx_status_json->>$3) is not null) > 0
         ORDER BY flag_n DESC`,
        [start, end, T1],
      ).then((r) => r.rows as StatusMix[]),
      pool.query(
        `SELECT uhid, department, service_item, tat1_min::float AS minutes
         FROM tests WHERE report_date >= $1::date AND report_date < $2::date
           AND tat1_min is not null AND (kx_status_json->>$3)='Critical'
         ORDER BY tat1_min DESC LIMIT 10`,
        [start, end, T1],
      ).then((r) => r.rows as LeaderRow[]),
      pool.query(
        `SELECT uhid, department, service_item, tat2_min::float AS minutes
         FROM tests WHERE report_date >= $1::date AND report_date < $2::date
           AND tat2_min is not null AND (kx_status_json->>$3)='Critical'
         ORDER BY tat2_min DESC LIMIT 10`,
        [start, end, T2],
      ).then((r) => r.rows as LeaderRow[]),
      pool.query(
        `SELECT to_char(report_date,'YYYY-MM-DD') AS date, count(*)::int AS n,
           percentile_cont(0.5) within group (order by tat1_min) filter (where tat1_min>=0) AS tat1_med,
           count(*) filter (where (kx_status_json->>$3)='Critical')::int AS t1_crit,
           count(*) filter (where (kx_status_json->>$3) is not null)::int AS t1_flag
         FROM tests WHERE report_date >= $1::date AND report_date < $2::date
         GROUP BY 1 ORDER BY 1`,
        [start, end, T1],
      ).then((r) => r.rows.map((x: any) => ({ date: x.date, n: x.n, tat1_med: num(x.tat1_med), t1_crit: x.t1_crit, t1_flag: x.t1_flag })) as DaySeriesPoint[]),
    ]);

    return { month, prevMonth: prevHas > 0 ? prevMonth : null, kpis, prevKpis, deptRates, statusMix, topTat1, topTat2, series };
  } catch (e) { return { error: (e as Error).message }; }
}
