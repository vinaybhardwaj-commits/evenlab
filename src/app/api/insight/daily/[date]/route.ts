import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCachedInsight, generateDailyInsight } from "@/lib/ai/insights";
import { isDate } from "@/lib/report/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: { date: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDate(params.date)) return NextResponse.json({ error: "Bad date" }, { status: 400 });
  return NextResponse.json({ text: await getCachedInsight("day", params.date) });
}

export async function POST(_req: Request, { params }: { params: { date: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDate(params.date)) return NextResponse.json({ error: "Bad date" }, { status: 400 });
  try {
    return NextResponse.json({ text: await generateDailyInsight(params.date) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
