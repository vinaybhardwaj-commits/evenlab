// Even Lab — ingestion entry point.
import type { IngestResult, IngestSummary, TestRecord } from "./types";
import { parseKareXpertWithCount } from "./parse";
import { dedupeBatch } from "./dedup";

export * from "./types";
export { parseKareXpert, parseKareXpertWithCount } from "./parse";
export { dedupeBatch, mergeRecords } from "./dedup";

function summarize(
  rowsInFile: number,
  records: TestRecord[],
  duplicatesMerged: number,
  droppedNoId: number,
): IngestSummary {
  const dates = records.map((r) => r.report_date).filter((d): d is string => !!d).sort();
  const departments: Record<string, number> = {};
  let withTat1 = 0, withTat2 = 0;
  for (const r of records) {
    const dept = r.department ?? "Unspecified";
    departments[dept] = (departments[dept] ?? 0) + 1;
    if (r.tat1_min != null && r.tat1_min >= 0) withTat1++;
    if (r.tat2_min != null && r.tat2_min >= 0) withTat2++;
  }
  return {
    rowsInFile,
    uniqueTests: records.length,
    duplicatesMerged,
    droppedNoId,
    withTat1,
    withTat2,
    dateRangeStart: dates[0] ?? null,
    dateRangeEnd: dates[dates.length - 1] ?? null,
    departments,
  };
}

/**
 * Parse + de-duplicate a KareXpert CSV. Pure (no DB) — returns merged records
 * and a summary the upload UI shows before committing.
 */
export function ingestUpload(content: string | Buffer): IngestResult {
  const { records: parsed, dataRowCount } = parseKareXpertWithCount(content);
  const droppedNoId = Math.max(0, dataRowCount - parsed.length);
  const { records, duplicatesMerged } = dedupeBatch(parsed);
  return { records, summary: summarize(dataRowCount, records, duplicatesMerged, droppedNoId) };
}
