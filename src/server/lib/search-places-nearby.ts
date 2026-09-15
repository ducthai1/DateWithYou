/**
 * Finding places the couple has not saved yet — carefully, and not often.
 *
 * A space with three saved cafés cannot produce an afternoon, and a space with
 * three saved cafés is exactly what someone arriving from the two SEO pages
 * has. So the planner is allowed to ask Google for places it does not know —
 * but this is the only code in the app that spends money per call, so every
 * guard here exists to keep that spending bounded and visible.
 *
 * Three guards, in this order:
 *
 *  1. **No key, no call.** Same shape as `upload.sign` reporting a missing
 *     Cloudinary config: an empty list and a reason, never an exception. The
 *     plan still comes out, built from saved places.
 *  2. **A daily allowance per space**, claimed in the database before the
 *     request goes out, so two tabs cannot both spend the last one.
 *  3. **A short in-memory cache**, because tapping "another one" three times
 *     in a minute is the normal way to use this feature.
 *
 * On Google's terms: the place id may be stored indefinitely and is what gets
 * written to a Location row. Everything else that comes back — name, rating,
 * price, hours — is treated as perishable: cached for minutes, and written to
 * the database only when a person confirms a plan that contains it.
 */
import { CATEGORIES, DISTRICTS } from "@/lib/districts-categories";
import { LocationConfigModel } from "@/server/db/models/location-config";
import { connectToDatabase } from "@/server/db/connect";
import { mapTextSearchResponse, type NearbyPlace } from "@/lib/places-text-search-map";

export type { NearbyPlace };

/** How many Text Search calls one space may spend per day. */
export const PLACES_DAILY_CAP = 3;

/** Deliberately short: only the place id is ours to keep for long. */
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 200;
const CALL_TIMEOUT_MS = 4_000;

/*
 * The field mask is the price list.
 *
 * Places API (New) bills by which fields you ask for, so this string is the
 * difference between a cheap call and an expensive one. It asks for exactly
 * what the planner uses and nothing else — adding a field here costs money on
 * every call the app ever makes.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.formattedAddress",
  "places.rating",
  "places.priceLevel",
  "places.regularOpeningHours",
].join(",");

export type SearchReason = null | "no-key" | "daily-cap" | "failed";
export type NearbyResult = { places: NearbyPlace[]; reason: SearchReason; spent: boolean };

type CacheEntry = { at: number; places: NearbyPlace[] };
const cache = new Map<string, CacheEntry>();

/** ~1.1 km cells: fine enough to matter, coarse enough to be hit twice. */
const cellOf = (geo: { lat: number; lng: number }) =>
  `${geo.lat.toFixed(2)},${geo.lng.toFixed(2)}`;

/**
 * Take one off today's allowance, or report that there is none left.
 *
 * Separated from the network call so the allowance itself can be tested
 * without a key, without quota and without a request — which is the part that
 * actually has to be right. The claim is made BEFORE the request goes out: a
 * call that fails after Google answered has still been billed, and pretending
 * otherwise would let a failing key burn the allowance forever.
 */
export async function claimPlacesSearch(
  spaceId: string,
  dateKey: string,
): Promise<{ ok: boolean; used: number }> {
  await connectToDatabase();
  /*
   * Three statements, not one clever upsert.
   *
   * The clever version — upsert on `{ spaceId, placesSearchDate: { $ne: key } }`
   * — looks like it does all of this at once and does not: when the row exists
   * and is already on today's key the filter matches nothing, so Mongo inserts
   * a SECOND row for the space and the unique index rejects it. An upsert
   * filter has to identify the document, not describe the state you want.
   */
  await LocationConfigModel.updateOne(
    { spaceId },
    {
      $setOnInsert: {
        categories: CATEGORIES,
        districts: DISTRICTS,
        placesSearchDate: dateKey,
        placesSearchCount: 0,
      },
    },
    { upsert: true },
  );
  // A different day key means the allowance has already rolled over; resetting
  // it here is why no scheduled job has to.
  await LocationConfigModel.updateOne(
    { spaceId, placesSearchDate: { $ne: dateKey } },
    { $set: { placesSearchDate: dateKey, placesSearchCount: 0 } },
  );
  const claimed = await LocationConfigModel.findOneAndUpdate(
    { spaceId, placesSearchDate: dateKey, placesSearchCount: { $lt: PLACES_DAILY_CAP } },
    { $inc: { placesSearchCount: 1 } },
    { new: true },
  ).lean<{ placesSearchCount: number }>();
  if (claimed) return { ok: true, used: claimed.placesSearchCount };
  return { ok: false, used: PLACES_DAILY_CAP };
}

export async function searchPlacesNearby(opts: {
  spaceId: string;
  /** What to look for, in the couple's own words ("quán cà phê Thảo Điền"). */
  query: string;
  near: { lat: number; lng: number };
  radiusM?: number;
  /** Sunday = 0, matching `Date#getDay` and Google's own numbering. */
  weekday: number;
  /** Saigon day key the allowance belongs to. */
  dateKey: string;
}): Promise<NearbyResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  // Checked before the allowance is touched: a missing key must not burn a
  // call that was never made.
  if (!key) return { places: [], reason: "no-key", spent: false };

  const cacheKey = `${opts.dateKey}|${opts.weekday}|${opts.query}|${cellOf(opts.near)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { places: hit.places, reason: null, spent: false };
  }

  const claim = await claimPlacesSearch(opts.spaceId, opts.dateKey);
  if (!claim.ok) return { places: [], reason: "daily-cap", spent: false };

  const ctrl = new AbortController();
  const deadline = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: opts.query,
        languageCode: "vi",
        regionCode: "VN",
        maxResultCount: 12,
        locationBias: {
          circle: {
            center: { latitude: opts.near.lat, longitude: opts.near.lng },
            radius: Math.min(50_000, Math.max(500, opts.radiusM ?? 4_000)),
          },
        },
      }),
    });
    // An error body is still a body: the mapper reads it as no places, which
    // is what the caller needs anyway.
    const places = mapTextSearchResponse(await res.json().catch(() => null), {
      weekday: opts.weekday,
    });
    if (places.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(cacheKey, { at: Date.now(), places });
    }
    return { places, reason: places.length ? null : "failed", spent: true };
  } catch {
    // Timeout, DNS, a rejected key — none of them may break the plan.
    return { places: [], reason: "failed", spent: true };
  } finally {
    clearTimeout(deadline);
  }
}

/** Test seam: the cache is process-wide and would leak between suites. */
export function __clearPlacesCache() {
  cache.clear();
}
