import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReport, isDate } from "@/lib/report/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: { date: string; fmt: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, fmt } = params;
  if (!isDate(date) || !["pdf", "png", "html"].includes(fmt)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const a = await getReport("daily", date, fmt);
    if (!a) return NextResponse.json({ error: "No data for this date" }, { status: 404 });
    return new NextResponse(new Uint8Array(a.bytes), {
      headers: {
        "content-type": a.mime,
        "content-disposition": `${a.inline ? "inline" : "attachment"}; filename="${a.filename}"`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Report failed: ${(e as Error).message}` }, { status: 500 });
  }
}
