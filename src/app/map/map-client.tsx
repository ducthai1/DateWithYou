"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { MapLoadingVeil } from "@/features/locations/map-loading-veil";

// The map screen is inherently client-only: it renders a WebGL map (maplibre),
// reads the live GPS position, and uses better-auth's useSession — none of which
// server-render meaningfully, and useSession actually throws during SSR ("Cannot
// read properties of null (reading 'useRef')"), forcing React to discard the
// server render and re-do it on the client. Loading it with ssr:false skips that
// wasted, error-throwing server pass entirely.
//
// The fallback is the same veil the route already painted, so the handover from
// server HTML to client tree changes nothing on screen. It covers the window
// after hydration but before this chunk has arrived — on a first visit at
// 1.5 Mbps that is measured at ~3.5s, and it used to be blank.
const LocationsPage = dynamic(
  () => import("@/features/locations/locations-page").then((m) => m.LocationsPage),
  { ssr: false, loading: () => <MapLoadingVeil show anchor="fixed" /> },
);

export function MapClient() {
  /*
   * Retire the route's pre-hydration veil.
   *
   * That copy is in the server HTML and React keeps it in the tree, so without
   * this it would sit behind the live map forever — invisible (the map paints
   * over it) but still running two infinite CSS animations on the app's
   * heaviest screen. Handing the flag over on THIS component's mount rather
   * than the map's is deliberate: this is the moment the fallback above starts
   * painting the identical veil, so there is no frame with neither.
   */
  useEffect(() => {
    document.documentElement.dataset.mapClient = "1";
    return () => {
      delete document.documentElement.dataset.mapClient;
    };
  }, []);

  return <LocationsPage />;
}
