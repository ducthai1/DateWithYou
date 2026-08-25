import type { Metadata } from "next";
import { CalendarView } from "@/features/calendar/calendar-view";

export const metadata: Metadata = {
  title: "Lịch",
  robots: { index: false, follow: false },
};

export default function CalendarPage() {
  return <CalendarView />;
}
