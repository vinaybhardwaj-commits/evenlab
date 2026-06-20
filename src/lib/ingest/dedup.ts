// Even Lab — de-duplication / merge by test_uid.
// Rule (PRD #5,#7): uploads may overlap; upsert by test_uid keeping the latest,
// most-complete record. We coalesce field-by-field so a later upload that fills
// in (e.g.) the verification timestamp never erases earlier known values.
import type { StageTimestamps, TestRecord } from "./types";
import { tat1, tat2, stageDurations, istReportDate } from "./metrics";

const TS_FIELDS: (keyof StageTimestamps)[] = [
  "ts_ordered", "ts_booked", "ts_checkin", "ts_collected", "ts_dispatched",
  "ts_acknowledged", "ts_processed", "ts_result_entry", "ts_verified",
  "ts_report_completed", "ts_report_uploaded",
];

const coalesce = <T>(incoming: T | null | undefined, existing: T | null | undefined): T | null =>
  (incoming !== null && incoming !== undefined ? incoming : (existing ?? null));

/** Merge two records for the same test_uid. `incoming` wins where it has a value. */
export function mergeRecords(existing: TestRecord, incoming: TestRecord): TestRecord {
  const merged: TestRecord = { ...existing };

  // timestamps — keep any known value, prefer the incoming when present
  for (const f of TS_FIELDS) merged[f] = coalesce(incoming[f], existing[f]);

  // scalar identity / case-mix
  merged.test_uid = existing.test_uid;
  merged.source_upload_id = coalesce(incoming.source_upload_id, existing.source_upload_id);
  merged.order_id = coalesce(incoming.order_id, existing.order_id);
  merged.accession_id = coalesce(incoming.accession_id, existing.accession_id);
  merged.uhid = coalesce(incoming.uhid, existing.uhid);
  merged.patient_name = coalesce(incoming.patient_name, existing.patient_name);
  merged.patient_type = coalesce(incoming.patient_type, existing.patient_type);
  merged.department = coalesce(incoming.department, existing.department);
  merged.service_item = coalesce(incoming.service_item, existing.service_item);
  merged.service_code = coalesce(incoming.service_code, existing.service_code);
  merged.treating_doctor = coalesce(incoming.treating_doctor, existing.treating_doctor);
  merged.is_outsourced = coalesce(incoming.is_outsourced, existing.is_outsourced);
  merged.payer = coalesce(incoming.payer, existing.payer);
  merged.facility = coalesce(incoming.facility, existing.facility);

  // status flags — union, incoming keys win
  merged.kx_status = { ...existing.kx_status, ...incoming.kx_status };

  // recompute derived from merged timestamps
  merged.report_date = istReportDate(merged);
  merged.tat1_min = tat1(merged);
  merged.tat2_min = tat2(merged);
  merged.stage_durations = stageDurations(merged);
  return merged;
}

/** Collapse a batch of rows to one record per test_uid. Returns merged list + count. */
export function dedupeBatch(records: TestRecord[]): { records: TestRecord[]; duplicatesMerged: number } {
  const byId = new Map<string, TestRecord>();
  let duplicatesMerged = 0;
  for (const rec of records) {
    const prev = byId.get(rec.test_uid);
    if (prev) {
      byId.set(rec.test_uid, mergeRecords(prev, rec));
      duplicatesMerged++;
    } else {
      byId.set(rec.test_uid, rec);
    }
  }
  return { records: [...byId.values()], duplicatesMerged };
}
