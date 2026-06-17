import { Suspense } from "react";
import { LocationsPage } from "@/features/locations/locations-page";

export default function MapPage() {
  return (
    <Suspense fallback={<div>Đang tải bản đồ...</div>}>
      <LocationsPage />
    </Suspense>
  );
}
