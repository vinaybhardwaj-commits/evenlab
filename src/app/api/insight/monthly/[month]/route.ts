import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCachedInsight, generateMonthlyInsight } from "@/lib/ai/insights";
import { isMonth } from "@/lib/report/generate";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET(_req: Request, { params }: { params: { month: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMonth(params.month)) return NextResponse.json({ error: "Bad month" }, { status: 400 });
  return NextResponse.json({ text: await getCachedInsight("month", params.month) });
}

export async function POST(_req: Request, { params }: { params: { month: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMonth(params.month)) return NextResponse.json({ error: "Bad month" }, { status: 400 });
  try {
    return NextResponse.json({ text: await generateMonthlyInsight(params.month) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
