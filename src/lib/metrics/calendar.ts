// Even Lab — calendar / month-index metrics.
import type { Pool } from "pg";
import { getPool } from "../db/client";

export interface MonthCount { month: string; count: number; } // month = 'YYYY-MM'
export interface DayCount { date: string; count: number; }     // date = 'YYYY-MM-DD'

/** Months that have data, newest first. */
export async function getMonthsWithData(): Promise<MonthCount[] | { error: string }> {
  let pool: Pool;
  try { pool = getPool(); } catch (e) { return { error: (e as Error).message }; }
  try {
    const { rows } = await pool.query(
      `SELECT to_char(report_date,'YYYY-MM') AS month, count(*)::int AS count
       FROM tests WHERE report_date IS NOT NULL
       GROUP BY 1 ORDER BY 1 DESC`,
    );
    return rows as MonthCount[];
  } catch (e) { return { error: (e as Error).message }; }
}

/** Per-day test counts within a given month ('YYYY-MM'). */
export async function getDaysWithData(month: string): Promise<{ days: DayCount[]; latestMonth: string | null } | { error: string }> {
  let pool: Pool;
  try { pool = getPool(); } catch (e) { return { error: (e as Error).message }; }
  try {
    const start = `${month}-01`;
    const { rows } = await pool.query(
      `SELECT to_char(report_date,'YYYY-MM-DD') AS date, count(*)::int AS count
       FROM tests
       WHERE report_date >= $1::date AND report_date < ($1::date + INTERVAL '1 month')
       GROUP BY 1 ORDER BY 1`,
      [start],
    );
    const lm = (await pool.query<{ m: string }>(
      `SELECT to_char(max(report_date),'YYYY-MM') AS m FROM tests`)).rows[0]?.m ?? null;
    return { days: rows as DayCount[], latestMonth: lm };
  } catch (e) { return { error: (e as Error).message }; }
}
