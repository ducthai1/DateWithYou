import type { Metadata } from "next";
import { DayPlanScreen } from "@/features/day-plan/day-plan-screen";

export const metadata: Metadata = {
  title: "Hôm nay đi đâu?",
  robots: { index: false, follow: false },
};

export default function DayPlanPage() {
  return <DayPlanScreen />;
}
