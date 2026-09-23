import { geocodeAddress, placeCoords, suggestPlaces } from "@/server/lib/geocode-address";
import { resolveGeoFromMapsUrl, type FindPlacesNear } from "@/server/lib/resolve-maps-geo";
import type { LatLng } from "@/lib/maps";

/**
 * Wires the real resolvers into the pure link parser, in one place, so the
 * three callers that accept a pasted link cannot drift apart in what a link
 * means to them.
 */

/** How many suggestions are worth pricing a coordinate lookup for. */
const MAX_CANDIDATES = 5;

/**
 * The venues behind a name, in the provider's own order.
 *
 * Uses the same autocomplete the map's search box uses, and for the same
 * measured reason: it is the one endpoint that honours a location bias, so
 * "Biển Hồ" resolves to the one beside the shared camera rather than whichever
 * sorted first nationally. The coordinates come from a details call, because
 * autocomplete carries no geometry — one batched call for the whole shortlist,
 * not one per candidate.
 *
 * All of them are returned, not the first: a link with no camera leaves the
 * search unbiased, and then the caller needs something to choose between the
 * hits. Measured on one such link, the right place was the first AND second
 * suggestion, with six wrong ones behind it between 69km and 410km away.
 */
const findPlaces: FindPlacesNear = async (name, near) => {
  // Có camera thì phép chọn đã xong rồi: một ứng viên là đủ, và số lần gọi
  // details giữ nguyên như trước. Chỉ khi không có camera mới phải trả giá cho
  // cả danh sách, vì lúc đó plus code cần thứ để đối chiếu.
  const hits = (await suggestPlaces(name, near)).slice(0, near ? 1 : MAX_CANDIDATES);
  if (!hits.length) return [];
  const coords = await placeCoords(hits.map((h) => h.placeId));
  return hits.map((h) => coords[h.placeId]).filter((c): c is LatLng => !!c);
};

/** Coordinates behind a pasted Google/Apple Maps link, on any device. */
export function resolvePastedMapLink(url: string): Promise<LatLng | null> {
  return resolveGeoFromMapsUrl(url, geocodeAddress, findPlaces);
}
