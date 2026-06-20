import { getDailyDashboard } from "@/lib/metrics/daily";
import TodayView from "@/components/TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await getDailyDashboard();
  return <TodayView data={data} />;
}
