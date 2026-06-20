// Even Lab — daily dashboard metrics (deterministic SQL over the `tests` table).
import type { Pool } from "pg";
import { getPool } from "../db/client";

const T1 = "Collected-Result Entered";
const T2 = "Result Entered-Result Verified";

export interface DayKpis {
  tests: number;
  tat1_med: number | null;
  tat2_med: number | null;
  t1_flag: number; t1_crit: number;
  t2_flag: number; t2_crit: number;
}
export interface DeptRate {
  department: string; n: number;
  t1_crit: number; t1_flag: number; t2_crit: number; t2_flag: number;
}
export interface StatusMix {
  department: string; normal: number; warning: number; critical: number; flag_n: number;
}
export interface LeaderRow {
  uhid: string | null; department: string | null; service_item: string | null; minutes: number;
}
export interface DailyDashboard {
  date: string | null;
  prevDate: string | null;
  kpis: DayKpis | null;
  prevKpis: DayKpis | null;
  deptRates: DeptRate[];
  statusMix: StatusMix[];
  topTat1: LeaderRow[];
  topTat2: LeaderRow[];
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

async function getKpis(pool: Pool, date: string): Promise<DayKpis> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS tests,
       percentile_cont(0.5) within group (order by tat1_min)
         filter (where tat1_min is not null and tat1_min >= 0) AS tat1_med,
       percentile_cont(0.5) within group (order by tat2_min)
         filter (where tat2_min is not null and tat2_min >= 0) AS tat2_med,
       count(*) filter (where (kx_status_json->>$2) is not null)::int AS t1_flag,
       count(*) filter (where (kx_status_json->>$2) = 'Critical')::int AS t1_crit,
       count(*) filter (where (kx_status_json->>$3) is not null)::int AS t2_flag,
       count(*) filter (where (kx_status_json->>$3) = 'Critical')::int AS t2_crit
     FROM tests WHERE report_date = $1`,
    [date, T1, T2],
  );
  const r = rows[0] ?? {};
  return {
    tests: r.tests ?? 0,
    tat1_med: num(r.tat1_med), tat2_med: num(r.tat2_med),
    t1_flag: r.t1_flag ?? 0, t1_crit: r.t1_crit ?? 0,
    t2_flag: r.t2_flag ?? 0, t2_crit: r.t2_crit ?? 0,
  };
}

export async function getDailyDashboard(dateArg?: string): Promise<DailyDashboard | { error: string }> {
  let pool: Pool;
  try { pool = getPool(); } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    const latest = dateArg
      ?? (await pool.query<{ d: string }>(
            `SELECT to_char(max(report_date),'YYYY-MM-DD') AS d FROM tests`)).rows[0]?.d
      ?? null;

    if (!latest) {
      return { date: null, prevDate: null, kpis: null, prevKpis: null, deptRates: [], statusMix: [], topTat1: [], topTat2: [] };
    }

    const prevDate = (await pool.query<{ d: string }>(
      `SELECT to_char(max(report_date),'YYYY-MM-DD') AS d FROM tests WHERE report_date < $1`, [latest],
    )).rows[0]?.d ?? null;

    const [kpis, prevKpis, deptRates, statusMix, topTat1, topTat2] = await Promise.all([
      getKpis(pool, latest),
      prevDate ? getKpis(pool, prevDate) : Promise.resolve(null),
      pool.query(
        `SELECT department, count(*)::int AS n,
           count(*) filter (where (kx_status_json->>$2)='Critical')::int AS t1_crit,
           count(*) filter (where (kx_status_json->>$2) is not null)::int AS t1_flag,
           count(*) filter (where (kx_status_json->>$3)='Critical')::int AS t2_crit,
           count(*) filter (where (kx_status_json->>$3) is not null)::int AS t2_flag
         FROM tests WHERE report_date=$1 GROUP BY department ORDER BY n DESC`,
        [latest, T1, T2],
      ).then((r) => r.rows as DeptRate[]),
      pool.query(
        `SELECT department,
           count(*) filter (where (kx_status_json->>$2)='Normal')::int AS normal,
           count(*) filter (where (kx_status_json->>$2)='Warning')::int AS warning,
           count(*) filter (where (kx_status_json->>$2)='Critical')::int AS critical,
           count(*) filter (where (kx_status_json->>$2) is not null)::int AS flag_n
         FROM tests WHERE report_date=$1 GROUP BY department
         HAVING count(*) filter (where (kx_status_json->>$2) is not null) > 0
         ORDER BY flag_n DESC`,
        [latest, T1],
      ).then((r) => r.rows as StatusMix[]),
      pool.query(
        `SELECT uhid, department, service_item, tat1_min::float AS minutes
         FROM tests WHERE report_date=$1 AND tat1_min is not null
           AND (kx_status_json->>$2)='Critical'
         ORDER BY tat1_min DESC LIMIT 8`,
        [latest, T1],
      ).then((r) => r.rows as LeaderRow[]),
      pool.query(
        `SELECT uhid, department, service_item, tat2_min::float AS minutes
         FROM tests WHERE report_date=$1 AND tat2_min is not null
           AND (kx_status_json->>$2)='Critical'
         ORDER BY tat2_min DESC LIMIT 8`,
        [latest, T2],
      ).then((r) => r.rows as LeaderRow[]),
    ]);

    return { date: latest, prevDate, kpis, prevKpis, deptRates, statusMix, topTat1, topTat2 };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
