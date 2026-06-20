// Even Lab — ingestion types

/** Epoch-ms timestamps extracted from KareXpert JSON stage fields. */
export interface StageTimestamps {
  ts_ordered: number | null;
  ts_booked: number | null;
  ts_checkin: number | null;
  ts_collected: number | null;
  ts_dispatched: number | null;
  ts_acknowledged: number | null;
  ts_processed: number | null;
  ts_result_entry: number | null;
  ts_verified: number | null;
  ts_report_completed: number | null;
  ts_report_uploaded: number | null;
}

/** A normalized, de-duplicated test record ready to upsert. */
export interface TestRecord extends StageTimestamps {
  test_uid: string;
  source_upload_id?: number | null;

  // identity / case-mix
  order_id: string | null;
  accession_id: string | null;
  uhid: string | null;
  patient_name: string | null;
  patient_type: string | null;
  department: string | null;
  service_item: string | null;
  service_code: string | null;
  treating_doctor: string | null;
  is_outsourced: boolean | null;
  payer: string | null;
  facility: string | null;

  // KareXpert per-segment status flags, e.g. { "Collected-Result Entered": "Critical" }
  kx_status: Record<string, string>;

  // derived (also generated in DB; computed here for the no-DB CLI summary)
  report_date: string | null; // YYYY-MM-DD in IST
  tat1_min: number | null;
  tat2_min: number | null;
  stage_durations: Record<string, number>;
}

export interface IngestSummary {
  rowsInFile: number;
  uniqueTests: number;
  duplicatesMerged: number;
  droppedNoId: number;
  withTat1: number;
  withTat2: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  departments: Record<string, number>;
}

export interface IngestResult {
  records: TestRecord[];
  summary: IngestSummary;
}
