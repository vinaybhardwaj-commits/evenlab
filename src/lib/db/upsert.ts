// Even Lab — upsert tests into Postgres.
// ON CONFLICT(test_uid): COALESCE timestamps so a later upload never erases an
// earlier known value; merge status JSON (incoming keys win); generated columns
// (report_date, tat1_min, tat2_min) recompute automatically.
import type { Pool } from "pg";
import type { TestRecord } from "../ingest/types";

const TS_COLS = [
  "ts_ordered", "ts_booked", "ts_checkin", "ts_collected", "ts_dispatched",
  "ts_acknowledged", "ts_processed", "ts_result_entry", "ts_verified",
  "ts_report_completed", "ts_report_uploaded",
] as const;

const SCALAR_COLS = [
  "order_id", "accession_id", "uhid", "patient_name", "patient_type", "department",
  "service_item", "service_code", "treating_doctor", "is_outsourced", "payer", "facility",
] as const;

// insert column order
const COLS = [
  "test_uid", "source_upload_id",
  ...SCALAR_COLS,
  ...TS_COLS,
  "kx_status_json", "stage_durations_json", "updated_at",
] as const;

const msToIso = (ms: number | null): string | null => (ms == null ? null : new Date(ms).toISOString());

function rowValues(rec: TestRecord, uploadId: number | null): unknown[] {
  return [
    rec.test_uid,
    uploadId,
    rec.order_id, rec.accession_id, rec.uhid, rec.patient_name, rec.patient_type,
    rec.department, rec.service_item, rec.service_code, rec.treating_doctor,
    rec.is_outsourced, rec.payer, rec.facility,
    msToIso(rec.ts_ordered), msToIso(rec.ts_booked), msToIso(rec.ts_checkin),
    msToIso(rec.ts_collected), msToIso(rec.ts_dispatched), msToIso(rec.ts_acknowledged),
    msToIso(rec.ts_processed), msToIso(rec.ts_result_entry), msToIso(rec.ts_verified),
    msToIso(rec.ts_report_completed), msToIso(rec.ts_report_uploaded),
    JSON.stringify(rec.kx_status), JSON.stringify(rec.stage_durations),
    new Date().toISOString(),
  ];
}

function buildUpsertSql(rowCount: number): string {
  const n = COLS.length;
  const valuesSql = Array.from({ length: rowCount }, (_, r) =>
    "(" + Array.from({ length: n }, (_, c) => `$${r * n + c + 1}`).join(",") + ")"
  ).join(",");

  const tsUpdates = TS_COLS.map((c) => `${c} = COALESCE(EXCLUDED.${c}, tests.${c})`);
  const scalarUpdates = SCALAR_COLS.map((c) => `${c} = COALESCE(EXCLUDED.${c}, tests.${c})`);
  const updates = [
    "source_upload_id = EXCLUDED.source_upload_id",
    ...scalarUpdates,
    ...tsUpdates,
    "kx_status_json = tests.kx_status_json || EXCLUDED.kx_status_json",
    "stage_durations_json = EXCLUDED.stage_durations_json",
    "updated_at = now()",
  ].join(", ");

  return `
    INSERT INTO tests (${COLS.join(", ")})
    VALUES ${valuesSql}
    ON CONFLICT (test_uid) DO UPDATE SET ${updates}
    RETURNING (xmax = 0) AS inserted
  `;
}

/** Upsert records in batches. Returns inserted/updated counts. */
export async function upsertTests(
  pool: Pool,
  records: TestRecord[],
  uploadId: number | null = null,
  batchSize = 200,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const params = batch.flatMap((r) => rowValues(r, uploadId));
    const sql = buildUpsertSql(batch.length);
    const res = await pool.query(sql, params);
    for (const row of res.rows as Array<{ inserted: boolean }>) {
      if (row.inserted) inserted++; else updated++;
    }
  }
  return { inserted, updated };
}
