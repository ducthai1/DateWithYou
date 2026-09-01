import type { Metadata } from "next";
import { RideHistory } from "@/features/rides/ride-history";

export const metadata: Metadata = {
  // Brand suffix comes from the title template in the root layout.
  title: "Lịch sử chuyến đi",
  robots: { index: false, follow: false },
};

export default function RidesPage() {
  return (
    // Matches /trips: no min-h-dvh / pb here, the app's fixed frame already
    // reserves room for the bottom nav and the scroll box inside PageShell
    // handles overflow.
    <main className="flex min-h-0 flex-1 flex-col">
      <RideHistory />
    </main>
  );
}
