import { TripDetail } from "@/features/trips/trip-detail";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Extract id from params
  const { id } = await params;

  return (
    <main className="min-h-dvh bg-background">
      <TripDetail id={id} />
    </main>
  );
}
