// Even Lab — one-off historical backfill.
// Loads large monthly KareXpert CSVs DIRECTLY into Neon, bypassing the app's
// upload route (Vercel caps function request bodies at 4.5 MB; monthly files
// are 12-15 MB). Mirrors the commit route: per file it records an `uploads`
// row, upserts `tests`, and stores the raw CSV blob in `files`. Idempotent
// (checksum + upsert), so safe to re-run.
//
//   DATABASE_URL=<neon pooled url> npx tsx scripts/backfill.ts <dir-or-file...>
//   e.g.  DATABASE_URL=... npx tsx scripts/backfill.ts ./historical
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ingestUpload } from "../src/lib/ingest/index";
import { getPool } from "../src/lib/db/client";
import { upsertTests } from "../src/lib/db/upsert";

function resolveFiles(args: string[]): string[] {
  const out: string[] = [];
  for (const a of args) {
    const s = statSync(a);
    if (s.isDirectory()) {
      for (const f of readdirSync(a)) if (f.toLowerCase().endsWith(".csv")) out.push(join(a, f));
    } else if (a.toLowerCase().endsWith(".csv")) {
      out.push(a);
    }
  }
  return out.sort();
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) { console.error("usage: backfill.ts <dir-or-file.csv ...>"); process.exit(1); }
  const files = resolveFiles(args);
  if (!files.length) { console.error("no .csv files found"); process.exit(1); }

  const pool = getPool();
  let totalIns = 0, totalUpd = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    const name = f.split("/").pop()!;
    const { records, summary } = ingestUpload(buf);
    const checksum = createHash("sha256").update(buf).digest("hex");

    const up = await pool.query<{ id: number }>(
      `INSERT INTO uploads (filename, checksum, row_count, date_range_start, date_range_end, status)
       VALUES ($1,$2,$3,$4,$5,'committed')
       ON CONFLICT (checksum) DO UPDATE SET filename = EXCLUDED.filename
       RETURNING id`,
      [name, checksum, summary.rowsInFile, summary.dateRangeStart, summary.dateRangeEnd],
    );
    const uploadId = up.rows[0]?.id ?? null;

    const { inserted, updated } = await upsertTests(pool, records, uploadId);

    // store raw blob once per checksum
    const exists = await pool.query(`SELECT 1 FROM files WHERE upload_id=$1 AND kind='raw_csv' LIMIT 1`, [uploadId]);
    if (!exists.rows.length) {
      await pool.query(
        `INSERT INTO files (kind, filename, mime, bytes, size_bytes, upload_id)
         VALUES ('raw_csv',$1,'text/csv',$2,$3,$4)`,
        [name, buf, buf.length, uploadId],
      );
    }
    await pool.query(
      `UPDATE uploads SET new_count=$2, updated_count=$3, duplicate_count=$4, dropped_count=$5 WHERE id=$1`,
      [uploadId, inserted, updated, summary.duplicatesMerged, summary.droppedNoId],
    );

    totalIns += inserted; totalUpd += updated;
    console.log(`${name}: ${summary.dateRangeStart}->${summary.dateRangeEnd}  rows=${summary.rowsInFile}  inserted=${inserted} updated=${updated}`);
  }

  const tot = await pool.query<{ n: string }>(`SELECT count(*) n FROM tests`);
  console.log(`\nDONE. inserted=${totalIns} updated=${totalUpd}. tests table now has ${tot.rows[0].n} rows.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
