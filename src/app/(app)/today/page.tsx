import { getDailyDashboard } from "@/lib/metrics/daily";
import { getCachedInsight } from "@/lib/ai/insights";
import TodayView from "@/components/TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: { date?: string } }) {
  const data = await getDailyDashboard(searchParams.date);
  const insight = !("error" in data) && data.date ? await getCachedInsight("day", data.date) : null;
  return <TodayView data={data} selectedDate={searchParams.date ?? null} insight={insight} />;
}
