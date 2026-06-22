"use client";

import dynamic from "next/dynamic";

// The map screen is inherently client-only: it renders a WebGL map (maplibre),
// reads the live GPS position, and uses better-auth's useSession — none of which
// server-render meaningfully, and useSession actually throws during SSR ("Cannot
// read properties of null (reading 'useRef')"), forcing React to discard the
// server render and re-do it on the client. Loading it with ssr:false skips that
// wasted, error-throwing server pass entirely and shows a light placeholder until
// the client bundle is ready.
const LocationsPage = dynamic(
  () => import("@/features/locations/locations-page").then((m) => m.LocationsPage),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải bản đồ…
      </div>
    ),
  },
);

export default function MapPage() {
  return <LocationsPage />;
}
