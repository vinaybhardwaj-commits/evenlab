import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ingestUpload } from "@/lib/ingest";
import { getPool } from "@/lib/db/client";
import { upsertTests } from "@/lib/db/upsert";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

// Commit an upload: record it, upsert tests, return insert/update counts.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  let pool;
  try { pool = getPool(); } catch (e) {
    return NextResponse.json({ error: `Database not configured: ${(e as Error).message}` }, { status: 503 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { records, summary } = ingestUpload(buf);
    const checksum = createHash("sha256").update(buf).digest("hex");

    // record the upload (idempotent on checksum)
    const up = await pool.query<{ id: number }>(
      `INSERT INTO uploads (filename, blob_url, checksum, row_count, date_range_start, date_range_end, status)
       VALUES ($1, NULL, $2, $3, $4, $5, 'committed')
       ON CONFLICT (checksum) DO UPDATE SET filename = EXCLUDED.filename
       RETURNING id`,
      [file.name, checksum, summary.rowsInFile, summary.dateRangeStart, summary.dateRangeEnd],
    );
    const uploadId = up.rows[0]?.id ?? null;

    const { inserted, updated } = await upsertTests(pool, records, uploadId);

    // keep the raw upload (decision: keep everything) — stored as a blob in Neon
    await pool.query(
      `INSERT INTO files (kind, filename, mime, bytes, size_bytes, upload_id)
       VALUES ('raw_csv', $1, 'text/csv', $2, $3, $4)`,
      [file.name, buf, buf.length, uploadId],
    );

    await pool.query(
      `UPDATE uploads SET new_count=$2, updated_count=$3, duplicate_count=$4, dropped_count=$5 WHERE id=$1`,
      [uploadId, inserted, updated, summary.duplicatesMerged, summary.droppedNoId],
    );
    await pool.query(
      `INSERT INTO audit_log (actor, action, entity, meta_json)
       VALUES ($1,'upload',$2,$3)`,
      [session.email, file.name, JSON.stringify({ inserted, updated, rows: summary.rowsInFile })],
    );

    return NextResponse.json({ ok: true, inserted, updated, summary });
  } catch (e) {
    return NextResponse.json({ error: `Import failed: ${(e as Error).message}` }, { status: 500 });
  }
}
