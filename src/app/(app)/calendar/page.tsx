import { getMonthsWithData, getDaysWithData } from "@/lib/metrics/calendar";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: { month?: string } }) {
  const monthsRes = await getMonthsWithData();
  const latest = Array.isArray(monthsRes) ? monthsRes[0]?.month : null;
  const now = new Date();
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = searchParams.month || latest || cur;
  const daysRes = await getDaysWithData(month);
  if ("error" in daysRes) return <CalendarView month={month} days={[]} error={daysRes.error} />;
  return <CalendarView month={month} days={daysRes.days} />;
}
