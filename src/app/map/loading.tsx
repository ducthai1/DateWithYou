import { MapLoadingVeil } from "@/features/locations/map-loading-veil";

/**
 * The map's own loading boundary: the veil, not the generic card skeleton.
 *
 * Two jobs. It gives `<Link href="/map">` something to prefetch, so tapping
 * the Bản đồ tab commits the navigation immediately instead of waiting for the
 * route's payload (see src/app/loading.tsx for the measurements). And what it
 * shows is exactly what the page itself shows a moment later, so the handover
 * is invisible — a card skeleton here would be a third placeholder in a row on
 * the way to one map.
 */
export default function Loading() {
  return <MapLoadingVeil show anchor="fixed" />;
}
