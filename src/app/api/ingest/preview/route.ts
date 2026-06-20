import { NextResponse } from "next/server";
import { ingestUpload } from "@/lib/ingest";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Parse + de-duplicate the uploaded CSV and return the validation summary.
// Does NOT write to the database — the user confirms before committing.
export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { summary } = ingestUpload(buf);
    if (summary.rowsInFile === 0) {
      return NextResponse.json({ error: "This file has no data rows. Is it a KareXpert TAT export?" }, { status: 422 });
    }
    return NextResponse.json({ filename: file.name, summary });
  } catch (e) {
    return NextResponse.json({ error: `Could not read this file: ${(e as Error).message}` }, { status: 422 });
  }
}
