import type { Metadata } from "next";
import { TripList } from "@/features/trips/trip-list";

export const metadata: Metadata = {
  // Brand suffix comes from the title template in the root layout.
  title: "Chuyến đi",
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return (
    <main className="min-h-dvh bg-background pb-20">
      <TripList />
    </main>
  );
}
