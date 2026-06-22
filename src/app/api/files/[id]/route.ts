import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// Authenticated download of a stored blob (raw CSV / generated report / image / deck).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  let pool;
  try { pool = getPool(); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const { rows } = await pool.query<{ filename: string; mime: string; bytes: Buffer }>(
    `SELECT filename, mime, bytes FROM files WHERE id = $1`, [id],
  );
  const f = rows[0];
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await pool.query(
    `INSERT INTO audit_log (actor, action, entity) VALUES ($1,'download',$2)`,
    [session.email, `file:${id}`],
  ).catch(() => {});

  return new NextResponse(new Uint8Array(f.bytes), {
    headers: {
      "content-type": f.mime || "application/octet-stream",
      "content-disposition": `attachment; filename="${f.filename.replace(/"/g, "")}"`,
    },
  });
}
