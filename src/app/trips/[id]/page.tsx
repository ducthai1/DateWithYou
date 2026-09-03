import { TripDetail } from "@/features/trips/trip-detail";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Extract id from params
  const { id } = await params;

  return (
    /*
       No wrapper of its own: the app frame already gives every screen its
       height and the artwork behind it, and `min-h-dvh bg-background` here
       painted a second opaque layer over that background — the flat white slab
       this page showed on desktop.
    */
    <TripDetail id={id} />
  );
}
