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
 *
 * **Two providers, and the second one is the realistic one.**
 *
 * Google's Text Search is the richer answer — it is the only free-tier source
 * of a price level — but a Maps Platform key needs a billing account with a
 * card on it, even to stay inside the free allowance. Stadia needs no payment
 * method at all, its key is already in this app for tiles and routing, and
 * running out is a hard stop rather than a bill. What it cannot supply is a
 * rating or a price, and no source that is free AND card-free can: Foursquare
 * puts ratings behind a premium tier, TripAdvisor asks for a card, and the
 * OSM-derived providers have neither. So those two stay unknown, which the
 * planner was already built to handle.
 *
 * Whichever key exists is used, Google first. Neither is required.
 */
import { CATEGORIES, DISTRICTS } from "@/lib/districts-categories";
import { LocationConfigModel } from "@/server/db/models/location-config";
import { connectToDatabase } from "@/server/db/connect";
import { mapTextSearchResponse, type NearbyPlace } from "@/lib/places-text-search-map";
import { mapStadiaResponse, STADIA_CATEGORY, STADIA_QUERY } from "@/lib/stadia-places-map";
import { PlaceSearchCacheModel } from "@/server/db/models/place-search-cache";
import type { SlotKind } from "@/lib/day-planner-taxonomy";

export type { NearbyPlace };

/** How many Text Search calls one space may spend per day. */
export const PLACES_DAILY_CAP = 3;

/** In-process, and on Vercel usually cold. The shared one below is the real one. */
const CACHE_TTL_MS = 30 * 60_000;
/** Long enough that "another one" three times in an evening costs one call. */
const SHARED_CACHE_TTL_MS = 6 * 60 * 60_000;
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
export type SearchProvider = "google" | "stadia";
export type NearbyResult = {
  places: NearbyPlace[];
  reason: SearchReason;
  spent: boolean;
  provider: SearchProvider | null;
};

/** Google when it has a key, otherwise Stadia, otherwise nothing. */
function pickProvider(): { provider: SearchProvider; key: string } | null {
  const google = process.env.GOOGLE_MAPS_API_KEY;
  if (google) return { provider: "google", key: google };
  const stadia = process.env.STADIA_API_KEY;
  if (stadia) return { provider: "stadia", key: stadia };
  return null;
}

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

/** One provider call. Returns null when the answer was unusable. */
async function callProvider(
  provider: SearchProvider,
  key: string,
  opts: { kind: SlotKind; query: string; near: { lat: number; lng: number }; radiusM?: number; weekday: number },
): Promise<NearbyPlace[] | null> {
  const ctrl = new AbortController();
  const deadline = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  const radius = Math.min(50_000, Math.max(500, opts.radiusM ?? 4_000));
  try {
    if (provider === "google") {
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
              radius,
            },
          },
        }),
      });
      // An error body is still a body: the mapper reads it as no places, which
      // is what the caller needs anyway.
      return mapTextSearchResponse(await res.json().catch(() => null), {
        weekday: opts.weekday,
      });
    }

    /*
     * Stadia's geocoder, asked the only way it can be asked.
     *
     * `categories` narrows the pool and `layers=venue` keeps it to places
     * rather than streets, but Pelias still matches on NAMES and returns no
     * category at all — so the query is name-shaped ("nhà hàng", not
     * "restaurant"), and the mapper throws out whatever does not read as the
     * right kind of place. Radius is in kilometres here, not metres.
     */
    const url = new URL("https://api.stadiamaps.com/geocoding/v1/search");
    url.searchParams.set("api_key", key);
    url.searchParams.set("text", STADIA_QUERY[opts.kind]);
    url.searchParams.set("layers", "venue");
    url.searchParams.set("categories", STADIA_CATEGORY[opts.kind]);
    url.searchParams.set("size", "20");
    url.searchParams.set("boundary.circle.lat", String(opts.near.lat));
    url.searchParams.set("boundary.circle.lon", String(opts.near.lng));
    url.searchParams.set("boundary.circle.radius", String(Math.round(radius / 1000)));
    const res = await fetch(url, { signal: ctrl.signal });
    return mapStadiaResponse(await res.json().catch(() => null), {
      weekday: opts.weekday,
      kind: opts.kind,
    });
  } catch {
    // Timeout, DNS, a rejected key — none of them may break the plan.
    return null;
  } finally {
    clearTimeout(deadline);
  }
}

export async function searchPlacesNearby(opts: {
  spaceId: string;
  /** Which kind of stop is being filled — decides the query and the filter. */
  kind: SlotKind;
  /** Free text, used by Google only; Stadia is asked by kind. */
  query: string;
  near: { lat: number; lng: number };
  radiusM?: number;
  /** Sunday = 0, matching `Date#getDay` and both providers' numbering. */
  weekday: number;
  /** Saigon day key the allowance belongs to. */
  dateKey: string;
}): Promise<NearbyResult> {
  const chosen = pickProvider();
  // Checked before the allowance is touched: a missing key must not burn a
  // call that was never made.
  if (!chosen) return { places: [], reason: "no-key", spent: false, provider: null };
  const { provider, key } = chosen;

  const cacheKey = `${provider}|${opts.kind}|${cellOf(opts.near)}|${opts.dateKey}|${opts.query}`;

  const hot = cache.get(cacheKey);
  if (hot && Date.now() - hot.at < CACHE_TTL_MS) {
    return { places: hot.places, reason: null, spent: false, provider };
  }

  /*
   * The shared cache, for OSM-derived answers only.
   *
   * "Cafés near this corner today" has the same answer for everybody, so one
   * couple's search spares the next one's allowance — and on Vercel this is
   * the only cache that survives, since each request may be a fresh instance.
   * Google's answers are deliberately NOT stored: their terms allow keeping
   * the place id and not the rest.
   */
  if (provider === "stadia") {
    const stored = await readSharedCache(cacheKey);
    if (stored) {
      cache.set(cacheKey, { at: Date.now(), places: stored });
      return { places: stored, reason: null, spent: false, provider };
    }
  }

  const claim = await claimPlacesSearch(opts.spaceId, opts.dateKey);
  if (!claim.ok) return { places: [], reason: "daily-cap", spent: false, provider };

  const places = await callProvider(provider, key, opts);
  if (!places) return { places: [], reason: "failed", spent: true, provider };

  if (places.length) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(cacheKey, { at: Date.now(), places });
    if (provider === "stadia") await writeSharedCache(cacheKey, places);
  }
  return { places, reason: places.length ? null : "failed", spent: true, provider };
}

/** A cache miss must never break a plan, so every failure reads as a miss. */
async function readSharedCache(key: string): Promise<NearbyPlace[] | null> {
  try {
    await connectToDatabase();
    const row = await PlaceSearchCacheModel.findOne({
      key,
      expiresAt: { $gt: new Date() },
    })
      .select("places")
      .lean<{ places: NearbyPlace[] }>();
    return row?.places ?? null;
  } catch (err) {
    console.error("searchPlacesNearby: shared cache read failed", err);
    return null;
  }
}

async function writeSharedCache(key: string, places: NearbyPlace[]): Promise<void> {
  try {
    await connectToDatabase();
    await PlaceSearchCacheModel.updateOne(
      { key },
      { $set: { places, expiresAt: new Date(Date.now() + SHARED_CACHE_TTL_MS) } },
      { upsert: true },
    );
  } catch (err) {
    console.error("searchPlacesNearby: shared cache write failed", err);
  }
}

/** Test seam: the cache is process-wide and would leak between suites. */
export function __clearPlacesCache() {
  cache.clear();
}
