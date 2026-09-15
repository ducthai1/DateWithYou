/**
 * Stadia's Pelias answer → places this app can plan with.
 *
 * Why this provider at all: the free plan needs no payment method, the key is
 * already in this app for tiles and routing, and running out is a hard stop
 * rather than a bill. What it cannot give is a rating or a price level — those
 * simply do not exist in any source that is free and card-free, so the planner
 * treats both as unknown, which it was already built to do.
 *
 * **The hard part is not parsing, it is rubbish.**
 *
 * Pelias is a geocoder: it matches NAMES, and it has no category field in its
 * response at all — a result carries `layer: "venue"` and nothing that says
 * whether it is a café or a district party office. Measured against the live
 * API, searching "quán ăn" with `categories=food` returns, in order: "Quận ủy
 * Quận 10", "BCH Quân sự Quận 4", "Cá sấu". All `match_type: "fallback"`,
 * because "quán/quận/quân" are one token apart after folding.
 *
 * So every result is checked against the SAME vocabulary the planner uses to
 * read a space's own category names: if the place's name does not read as the
 * kind of place this slot wants, it is dropped. That costs real venues whose
 * names say nothing ("Baron" is a bar, "Quán Bụi" is a restaurant) — and that
 * is the right side to be wrong on. A suggestion nobody asked for is forgiven;
 * sending two people to a party committee office is not.
 */
import { kindOfCategory, type SlotKind } from "@/lib/day-planner-taxonomy";
import { openingWindowFor } from "@/lib/osm-opening-hours";
import type { NearbyPlace } from "@/lib/places-text-search-map";

/** Pelias category filters, by the kind of stop being filled. */
export const STADIA_CATEGORY: Record<SlotKind, string> = {
  meal: "food",
  cafe: "food",
  drink: "nightlife",
  stroll: "recreation",
  entertain: "entertainment",
};

/** What to type at it. Pelias matches names, so these are name-shaped. */
export const STADIA_QUERY: Record<SlotKind, string> = {
  meal: "nhà hàng",
  cafe: "cà phê",
  drink: "bar",
  stroll: "công viên",
  entertain: "rạp phim",
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const inWorld = (lat: unknown, lng: unknown): boolean =>
  typeof lat === "number" && typeof lng === "number" &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/**
 * @param weekday Sunday = 0, matching `Date#getDay`.
 * @param kind    The slot being filled; results that do not read as this kind
 *                are dropped, because Pelias cannot be asked for a category.
 */
export function mapStadiaResponse(
  body: unknown,
  opts: { weekday: number; kind: SlotKind },
): NearbyPlace[] {
  if (!isObj(body) || !Array.isArray(body.features)) return [];
  const out: NearbyPlace[] = [];
  const seen = new Set<string>();

  for (const raw of body.features) {
    if (!isObj(raw)) continue;
    const p = isObj(raw.properties) ? raw.properties : null;
    const g = isObj(raw.geometry) ? raw.geometry : null;
    if (!p || !g || !Array.isArray(g.coordinates)) continue;

    const [lng, lat] = g.coordinates as unknown[];
    const name = typeof p.name === "string" ? p.name.trim() : "";
    const id = typeof p.gid === "string" ? p.gid : typeof p.id === "string" ? p.id : "";
    if (!name || !id || !inWorld(lat, lng)) continue;

    // The rubbish filter. See the note at the top of this file.
    if (kindOfCategory(name) !== opts.kind) continue;

    // Pelias returns the same venue from several sources (OSM way + node).
    const dedupe = `${name.toLowerCase()}|${(lat as number).toFixed(4)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const osm = isObj(p.addendum) && isObj(p.addendum.osm) ? p.addendum.osm : null;
    const window = openingWindowFor(osm?.opening_hours, opts.weekday);

    out.push({
      externalId: id,
      name,
      geo: { lat: lat as number, lng: lng as number },
      address: typeof p.label === "string" ? p.label : null,
      // Neither exists in any free, card-free source. Left unknown rather than
      // invented: the planner scores an unrated place as average, and the cost
      // band falls back to what that kind of stop usually costs.
      rating: null,
      priceLevel: null,
      openTime: window?.openTime ?? null,
      closeTime: window?.closeTime ?? null,
    });
  }
  return out;
}
