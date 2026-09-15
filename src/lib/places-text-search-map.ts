/**
 * Google's Text Search answer → rows this app can plan with.
 *
 * Every interesting field is optional on Google's side: a place can come back
 * with no price, no rating, no hours, and sometimes no coordinates at all. So
 * this is written to survive a body rather than to trust one — it skips what is
 * unusable, keeps what is not, and never throws, because the caller is halfway
 * through building somebody's evening when it runs.
 *
 * Pure on purpose, and separate from the network call, so the awkward parts can
 * be tested from a recorded body with no key and no quota — see
 * tests/unit/places-text-search-map.test.ts.
 *
 * **Why Text Search and not the autocomplete this repo already has.**
 * `suggestPlaces` is an autocomplete: it answers a half-typed name with an id
 * and a label, and nothing else — no rating, no price, no hours, not even
 * coordinates, which then cost a second call each. Text Search answers once
 * with all of it, which makes it cheaper per usable place and is the only
 * source of a price level the budget feature can actually use.
 */

export type NearbyPlace = {
  /** Google's place id — the one field their terms allow keeping indefinitely. */
  externalId: string;
  name: string;
  geo: { lat: number; lng: number };
  address?: string | null;
  rating?: number | null;
  /** 0–4, or null when Google did not say. Never defaulted to 0. */
  priceLevel?: number | null;
  /** "HH:mm" for the day being planned, or null when unknown for that day. */
  openTime: string | null;
  closeTime: string | null;
};

const LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/**
 * The price scale, from either generation of the API.
 *
 * `PRICE_LEVEL_UNSPECIFIED` and anything unrecognised return null rather than
 * 0: zero means "free" everywhere downstream, and a café quietly filed as free
 * would drag the whole budget band down with it.
 */
export function priceLevelToNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 && raw <= 4 ? raw : null;
  if (typeof raw === "string") return raw in LEVELS ? LEVELS[raw] : null;
  return null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clock = (h: unknown, m: unknown): string | null => {
  if (typeof h !== "number" || !Number.isInteger(h) || h < 0 || h > 23) return null;
  const min = typeof m === "number" && Number.isInteger(m) && m >= 0 && m <= 59 ? m : 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

/**
 * The opening window for one weekday.
 *
 * A period that opens on the planned day and closes on the next is kept as a
 * wrapped window (17:00 → 01:00) rather than dropped: that is a normal dinner
 * service here, and `isOpenAt` already reads a close time earlier than the open
 * time as running past midnight. A period belonging to a different day tells us
 * nothing about this one, so the answer is null — unknown, not closed.
 */
function hoursForDay(hours: unknown, weekday: number): { openTime: string | null; closeTime: string | null } {
  const none = { openTime: null, closeTime: null };
  if (!isObj(hours) || !Array.isArray(hours.periods)) return none;
  for (const period of hours.periods) {
    if (!isObj(period) || !isObj(period.open)) continue;
    if (period.open.day !== weekday) continue;
    const openTime = clock(period.open.hour, period.open.minute);
    const closeTime = isObj(period.close) ? clock(period.close.hour, period.close.minute) : null;
    // Half a window is worse than none: it would claim a closing time the
    // place never gave, or an opening with no end.
    if (!openTime || !closeTime) return none;
    return { openTime, closeTime };
  }
  return none;
}

const inWorld = (lat: unknown, lng: unknown): boolean =>
  typeof lat === "number" && typeof lng === "number" &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/**
 * @param weekday Google's numbering, Sunday = 0 — the same as `Date#getDay`.
 */
export function mapTextSearchResponse(body: unknown, opts: { weekday: number }): NearbyPlace[] {
  if (!isObj(body) || !Array.isArray(body.places)) return [];
  const out: NearbyPlace[] = [];
  for (const raw of body.places) {
    if (!isObj(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : null;
    const name = isObj(raw.displayName) && typeof raw.displayName.text === "string"
      ? raw.displayName.text
      : null;
    const loc = isObj(raw.location) ? raw.location : null;
    // No id, no name, or nowhere on earth: nothing downstream can use it — it
    // cannot be pinned, measured, deduplicated or navigated to.
    if (!id || !name || !loc || !inWorld(loc.latitude, loc.longitude)) continue;

    out.push({
      externalId: id,
      name,
      geo: { lat: loc.latitude as number, lng: loc.longitude as number },
      address: typeof raw.formattedAddress === "string" ? raw.formattedAddress : null,
      rating: typeof raw.rating === "number" ? raw.rating : null,
      priceLevel: priceLevelToNumber(raw.priceLevel),
      ...hoursForDay(raw.regularOpeningHours, opts.weekday),
    });
  }
  return out;
}
