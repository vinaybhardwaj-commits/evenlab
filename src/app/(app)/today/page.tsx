import { getDailyDashboard } from "@/lib/metrics/daily";
import TodayView from "@/components/TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: { date?: string } }) {
  const data = await getDailyDashboard(searchParams.date);
  return <TodayView data={data} selectedDate={searchParams.date ?? null} />;
}
