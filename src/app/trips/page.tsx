import { TripList } from "@/features/trips/trip-list";

export const metadata = {
  title: "Chuyến đi - Vivu No Plan",
};

export default function TripsPage() {
  return (
    <main className="min-h-dvh bg-background pb-20">
      <TripList />
    </main>
  );
}
