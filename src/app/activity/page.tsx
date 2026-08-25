import type { Metadata } from "next";
import { ActivityFeed } from "@/features/activity/activity-feed";

export const metadata: Metadata = {
  title: "Hoạt động",
  robots: { index: false, follow: false },
};

export default function ActivityPage() {
  return <ActivityFeed />;
}
