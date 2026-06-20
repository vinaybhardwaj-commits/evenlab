// Even Lab — KareXpert CSV parser.
// The export has DUPLICATE column headers; timestamps/status live as JSON inside
// repeated columns. We parse to arrays and merge same-named columns by index.
import { parse as parseCsv } from "csv-parse/sync";
import type { StageTimestamps, TestRecord } from "./types";
import { tat1, tat2, stageDurations, istReportDate } from "./metrics";

// KareXpert JSON timestamp key -> our field
const TS_KEYS: Record<string, keyof StageTimestamps> = {
  orderDateTime: "ts_ordered",
  bookingDate: "ts_booked",
  checkInDateTime: "ts_checkin",
  collectedDateTime: "ts_collected",
  dispatchedDateTime: "ts_dispatched",
  acknowledgedDateTime: "ts_acknowledged",
  processedDateTime: "ts_processed",
  resultEntryDateTime: "ts_result_entry",
  resultVerifiedDateTime: "ts_verified",
  reportCompletedDateTime: "ts_report_completed",
  reportUploadedDateTime: "ts_report_uploaded",
};

const EMPTY_TS = (): StageTimestamps => ({
  ts_ordered: null, ts_booked: null, ts_checkin: null, ts_collected: null,
  ts_dispatched: null, ts_acknowledged: null, ts_processed: null,
  ts_result_entry: null, ts_verified: null, ts_report_completed: null,
  ts_report_uploaded: null,
});

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildIndexMap(header: string[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  header.forEach((h, i) => {
    const key = (h ?? "").trim();
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(i);
  });
  return m;
}

/** Parse the raw CSV into normalized records plus the true data-row count. */
export function parseKareXpertWithCount(
  content: string | Buffer,
): { records: TestRecord[]; dataRowCount: number } {
  const rows = parseCsv(content, {
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    bom: true,
  }) as string[][];

  if (rows.length < 2) return { records: [], dataRowCount: 0 };
  const header = rows[0];
  const idx = buildIndexMap(header);

  const firstOf = (row: string[], name: string): string | null => {
    const positions = idx.get(name);
    if (!positions) return null;
    const v = row[positions[0]];
    return v == null || v === "" ? null : v.trim();
  };

  const mergeJson = (row: string[], name: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const i of idx.get(name) ?? []) {
      const raw = row[i];
      if (raw && raw.trim().startsWith("{")) {
        try { Object.assign(out, JSON.parse(raw)); } catch { /* ignore bad json */ }
      }
    }
    return out;
  };

  const records: TestRecord[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    // timestamps (merged across all stage_with_date_time columns)
    const stageJson = mergeJson(row, "stage_with_date_time");
    const ts = EMPTY_TS();
    for (const [k, field] of Object.entries(TS_KEYS)) {
      ts[field] = toNum(stageJson[k]);
    }

    // status flags (merged across all common_tat_status columns)
    const statusJson = mergeJson(row, "common_tat_status");
    const kx_status: Record<string, string> = {};
    for (const [k, v] of Object.entries(statusJson)) {
      if (typeof v === "string" && v) kx_status[k] = v;
    }

    // identity. orderId is an ORDER (many tests) and accessionIdentifier a SAMPLE
    // (many analytes) — neither is unique per test. The stable, unique-per-test
    // business key is orderId + serviceItemCode; fall back to the row id.
    const orderId = firstOf(row, "orderId");
    const serviceCode = firstOf(row, "serviceItemCode");
    const accessionId = firstOf(row, "accessionIdentifier");
    const rowId = firstOf(row, "id");
    const test_uid =
      (orderId && serviceCode ? `${orderId}::${serviceCode}` : null) ||
      rowId ||
      accessionId;
    if (!test_uid) continue; // dropped (no identity)

    records.push({
      test_uid,
      order_id: orderId,
      accession_id: accessionId,
      uhid: firstOf(row, "uhId"),
      patient_name: firstOf(row, "patient_name"),
      patient_type: firstOf(row, "patientType"),
      department: firstOf(row, "subDepartment_name"),
      service_item: firstOf(row, "serviceItemName"),
      service_code: firstOf(row, "serviceItemCode"),
      treating_doctor: firstOf(row, "treatingDoctor"),
      is_outsourced: (() => { const v = firstOf(row, "isOutSource"); return v == null ? null : v === "true"; })(),
      payer: firstOf(row, "payer_name"),
      facility: firstOf(row, "facility_name"),
      ...ts,
      kx_status,
      report_date: istReportDate(ts),
      tat1_min: tat1(ts),
      tat2_min: tat2(ts),
      stage_durations: stageDurations(ts),
    });
  }
  return { records, dataRowCount: rows.length - 1 };
}

/** Parse the raw CSV into normalized, per-row TestRecords (pre-dedup). */
export function parseKareXpert(content: string | Buffer): TestRecord[] {
  return parseKareXpertWithCount(content).records;
}
