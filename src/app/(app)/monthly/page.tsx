import { getMonthlyDashboard } from "@/lib/metrics/monthly";
import { getMonthsWithData } from "@/lib/metrics/calendar";
import { getCachedInsight } from "@/lib/ai/insights";
import MonthlyView from "@/components/MonthlyView";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({ searchParams }: { searchParams: { month?: string } }) {
  const data = await getMonthlyDashboard(searchParams.month);
  const monthsRes = await getMonthsWithData();
  const months = Array.isArray(monthsRes) ? monthsRes : [];
  const insight = !("error" in data) && data.month ? await getCachedInsight("month", data.month) : null;
  return <MonthlyView data={data} months={months} insight={insight} />;
}
