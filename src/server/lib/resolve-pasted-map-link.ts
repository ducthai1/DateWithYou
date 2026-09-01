import { geocodeAddress, placeDetail, suggestPlaces } from "@/server/lib/geocode-address";
import { resolveGeoFromMapsUrl, type FindPlaceNear } from "@/server/lib/resolve-maps-geo";
import type { LatLng } from "@/lib/maps";

/**
 * Wires the real resolvers into the pure link parser, in one place, so the
 * three callers that accept a pasted link cannot drift apart in what a link
 * means to them.
 */

/**
 * The venue behind a name, decided by where the camera was pointing.
 *
 * Uses the same autocomplete the map's search box uses, and for the same
 * measured reason: it is the one endpoint that honours a location bias, so
 * "Biển Hồ" resolves to the one beside the shared camera rather than whichever
 * sorted first nationally. The coordinate itself comes from a details call,
 * because autocomplete carries no geometry.
 */
const findPlaceNear: FindPlaceNear = async (name, near) => {
  const hits = await suggestPlaces(name, near);
  const first = hits[0];
  if (!first) return null;
  const detail = await placeDetail(first.placeId);
  return detail ? { lat: detail.lat, lng: detail.lng } : null;
};

/** Coordinates behind a pasted Google/Apple Maps link, on any device. */
export function resolvePastedMapLink(url: string): Promise<LatLng | null> {
  return resolveGeoFromMapsUrl(url, geocodeAddress, findPlaceNear);
}
