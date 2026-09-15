/**
 * Roughly how long a hop takes, without asking anybody.
 *
 * The preview screen does not need routing accuracy — it needs "is this next
 * door or across town". A real answer would cost a routing call per hop, and
 * Stadia's one-call matrix endpoint is not on the free plan (403, "please
 * upgrade"), so real times would mean two or three network calls added to
 * every press of a button people press repeatedly.
 *
 * So: straight-line metres, a city speed, and a label that says "khoảng". The
 * speed is deliberately pessimistic — 18 km/h is what a motorbike averages
 * across Saigon once lights, turns and traffic are counted, against a top
 * speed more than twice that — and the straight line already understates the
 * real distance, so the two errors push in opposite directions.
 *
 * Nothing here pretends to be an ETA. A time shown before you have chosen the
 * day is a hint; the real one comes from the router when the ride starts.
 */

/** Average door-to-door speed across town, not top speed. */
export const CITY_SPEED_KMH = 18;
/** Parking, finding the door, waiting to pull out. Flat, because it is. */
export const OVERHEAD_MIN = 2;

/**
 * Minutes for a hop of `metres`, or null when there is nothing to measure.
 *
 * Rounded to something a person would say out loud: a five-minute hop is "5
 * phút", not "4,7 phút", and anything under a couple of minutes is "ngay gần
 * đây" rather than a number pretending to precision it does not have.
 */
export function rideMinutes(metres: number | null | undefined): number | null {
  if (typeof metres !== "number" || !Number.isFinite(metres) || metres < 0) return null;
  const minutes = (metres / 1000 / CITY_SPEED_KMH) * 60 + OVERHEAD_MIN;
  return Math.max(1, Math.round(minutes));
}

/** The same, as the phrase the card shows. */
export function rideLabel(metres: number | null | undefined): string | null {
  if (typeof metres !== "number" || !Number.isFinite(metres) || metres < 0) return null;
  if (metres < 350) return "đi bộ được";
  const minutes = rideMinutes(metres);
  return minutes === null ? null : `khoảng ${minutes} phút chạy xe`;
}
