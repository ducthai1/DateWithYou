import type { Metadata } from "next";
import { TripList } from "@/features/trips/trip-list";

export const metadata: Metadata = {
  // Brand suffix comes from the title template in the root layout.
  title: "Chuyến đi",
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return (
    // No min-h-dvh / pb here any more: inside the app's fixed frame that added
    // a whole viewport of empty space below the list, and the scroll box
    // already reserves room for the bottom nav.
    <main className="flex min-h-0 flex-1 flex-col">
      <TripList />
    </main>
  );
}
