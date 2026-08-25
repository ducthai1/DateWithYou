import type { Metadata } from "next";
import { MemoryTimeline } from "@/features/memories/memory-timeline";

export const metadata: Metadata = {
  title: "Kỷ niệm",
  robots: { index: false, follow: false },
};

export default function TimelinePage() {
  return <MemoryTimeline />;
}
