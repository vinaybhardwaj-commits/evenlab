// Even Lab — pure metric helpers (TAT, stage durations, IST date bucket)
import type { StageTimestamps } from "./types";

/** Minutes between two epoch-ms values, or null if either missing/invalid. */
export function diffMin(aMs: number | null, bMs: number | null): number | null {
  if (aMs == null || bMs == null || aMs <= 0 || bMs <= 0) return null;
  const m = (bMs - aMs) / 60000;
  return Number.isFinite(m) ? m : null;
}

/** TAT 1 = sample collection -> result entry (minutes). */
export function tat1(ts: StageTimestamps): number | null {
  return diffMin(ts.ts_collected, ts.ts_result_entry);
}

/** TAT 2 = result entry -> verification (minutes). */
export function tat2(ts: StageTimestamps): number | null {
  return diffMin(ts.ts_result_entry, ts.ts_verified);
}

/** Named consecutive pathway-stage durations (minutes). Null stages are omitted. */
const STAGE_PAIRS: Array<[string, keyof StageTimestamps, keyof StageTimestamps]> = [
  ["booked_to_collected", "ts_booked", "ts_collected"],
  ["collected_to_acknowledged", "ts_collected", "ts_acknowledged"],
  ["acknowledged_to_entry", "ts_acknowledged", "ts_result_entry"],
  ["collected_to_entry", "ts_collected", "ts_result_entry"], // == TAT 1
  ["entry_to_verified", "ts_result_entry", "ts_verified"], // == TAT 2
  ["verified_to_report", "ts_verified", "ts_report_uploaded"],
];

export function stageDurations(ts: StageTimestamps): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, a, b] of STAGE_PAIRS) {
    const d = diffMin(ts[a], ts[b]);
    if (d != null) out[name] = Math.round(d * 10) / 10;
  }
  return out;
}

/** Report-date bucket = order/booking date, in IST (Asia/Kolkata), as YYYY-MM-DD. */
export function istReportDate(ts: StageTimestamps): string | null {
  const ms = ts.ts_ordered ?? ts.ts_booked;
  if (ms == null || ms <= 0) return null;
  // Asia/Kolkata is UTC+5:30 (no DST).
  const ist = new Date(ms + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}
