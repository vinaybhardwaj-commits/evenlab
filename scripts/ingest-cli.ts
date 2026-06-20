// Even Lab — ingestion CLI (for testing / local runs).
//   npm run ingest -- /path/to/lab_service_tat_report.csv          (parse-only summary)
//   npm run ingest -- /path/to/file.csv --db                       (also upsert to DATABASE_URL)
import { readFileSync } from "node:fs";
import { ingestUpload } from "../src/lib/ingest/index";

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const p90 = (xs: number[]): number | null =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.9) - 1)] : null;
const fmt = (m: number | null) =>
  m == null ? "–" : (m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m` : `${Math.round(m)}m`);

async function main() {
  const path = process.argv[2];
  const doDb = process.argv.includes("--db");
  if (!path) { console.error("usage: ingest-cli <csv> [--db]"); process.exit(1); }

  const content = readFileSync(path);
  const t0 = Date.now();
  const { records, summary } = ingestUpload(content);
  const ms = Date.now() - t0;

  const t1 = records.map((r) => r.tat1_min).filter((x): x is number => x != null && x >= 0);
  const t2 = records.map((r) => r.tat2_min).filter((x): x is number => x != null && x >= 0);
  const crit = (key: string) => {
    let flagged = 0, critical = 0;
    for (const r of records) { const s = r.kx_status[key]; if (s) { flagged++; if (s === "Critical") critical++; } }
    return { flagged, critical };
  };
  const c1 = crit("Collected-Result Entered");
  const c2 = crit("Result Entered-Result Verified");

  console.log("\n=== INGEST SUMMARY ===");
  console.log(`Parsed in ${ms} ms`);
  console.log(`Rows in file:        ${summary.rowsInFile}`);
  console.log(`Unique tests:        ${summary.uniqueTests}`);
  console.log(`Duplicates merged:   ${summary.duplicatesMerged}`);
  console.log(`Dropped (no id):     ${summary.droppedNoId}`);
  console.log(`Date range:          ${summary.dateRangeStart} -> ${summary.dateRangeEnd}`);
  console.log(`\nTAT1 computable:     ${summary.withTat1}  median ${fmt(median(t1))}  p90 ${fmt(p90(t1))}`);
  console.log(`TAT2 computable:     ${summary.withTat2}  median ${fmt(median(t2))}  p90 ${fmt(p90(t2))}`);
  console.log(`TAT1 Critical:       ${c1.critical}/${c1.flagged} (${c1.flagged ? Math.round(c1.critical / c1.flagged * 100) : 0}%)`);
  console.log(`TAT2 Critical:       ${c2.critical}/${c2.flagged} (${c2.flagged ? Math.round(c2.critical / c2.flagged * 100) : 0}%)`);
  console.log(`\nDepartments:`);
  for (const [d, n] of Object.entries(summary.departments).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(22)} ${n}`);
  }

  if (doDb) {
    const { getPool } = await import("../src/lib/db/client");
    const { upsertTests } = await import("../src/lib/db/upsert");
    const pool = getPool();
    const res = await upsertTests(pool, records);
    console.log(`\nDB upsert: inserted ${res.inserted}, updated ${res.updated}`);
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
