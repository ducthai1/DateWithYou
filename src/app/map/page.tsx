import { MapClient } from "./map-client";
import { MapLoadingVeil } from "@/features/locations/map-loading-veil";
import { MapAssetPreload } from "@/features/locations/map-asset-preload";

/**
 * The map route, and the one thing only the route can do: fill the wait.
 *
 * This file used to be `"use client"` and hand the whole screen to
 * `dynamic(..., { ssr: false })` with a "Đang tải bản đồ…" line as its
 * fallback. In the App Router that fallback is client-side too, so it renders
 * only after React has hydrated — and hydration is exactly what a phone on
 * mobile data is waiting for. Measured here on a throttled profile with a cold
 * cache: four seconds in, the screen was the app's header, the bottom nav, and
 * nothing at all between them. A blank screen, on a screen someone just tapped
 * to reach, reads as a broken app rather than a slow one.
 *
 * A server component can put something in the FIRST bytes of HTML. The veil
 * below is that something: it needs no JavaScript to paint, it says which
 * thing is loading, and it is the same artwork and wording the map's own veil
 * uses once the client tree takes over — so the two read as one continuous
 * state rather than two placeholders in a row.
 *
 * `#map-view` in the client tree is also `fixed inset-0 z-0` and comes later
 * in the DOM, so the live map paints over this one anyway — but painted over
 * is not gone: it would keep two infinite CSS animations running behind the
 * map for the rest of the visit. So MapClient hands over a `data-map-client`
 * flag on mount and one CSS rule takes this out of the layout for good.
 */
export default function MapPage() {
  return (
    <>
      {/* Before anything else: the map's fixed assets, so the tile server is
          working on them while the app's JavaScript is still downloading. */}
      <MapAssetPreload />
      <MapLoadingVeil show anchor="fixed" id="map-boot-veil" />
      <MapClient />
    </>
  );
}
