import { getMonthlyDashboard } from "@/lib/metrics/monthly";
import { getMonthsWithData } from "@/lib/metrics/calendar";
import MonthlyView from "@/components/MonthlyView";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({ searchParams }: { searchParams: { month?: string } }) {
  const data = await getMonthlyDashboard(searchParams.month);
  const monthsRes = await getMonthsWithData();
  const months = Array.isArray(monthsRes) ? monthsRes : [];
  return <MonthlyView data={data} months={months} />;
}
