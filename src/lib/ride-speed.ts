/**
 * How fast a motorbike actually gets across this city, and how to make the
 * router believe it.
 *
 * The provider's `motor_scooter` costing answers in FREE-FLOW time: measured
 * against Stadia's Valhalla on 17/09/2026, a 19.2 km crossing of Saigon came
 * back as 30 minutes — 38 km/h — at 17:30 and at 03:00 alike. A rider who
 * followed that same route reported an hour to an hour and a half.
 *
 * There is no traffic data to ask for. `date_time` is accepted and changes
 * nothing on this tier: the same request at rush hour and at three in the
 * morning returns the identical 30 minutes. So the correction has to be made
 * on our side.
 *
 * `top_speed` is the lever, and it is the right one: it goes INTO the routing
 * decision rather than multiplying the answer afterwards, so the line it picks
 * also changes — measured 19.16 km at the default and 18.68 km at 22, because
 * a slow cap stops big roads from looking worth the detour. Per-maneuver times
 * stay consistent with the total, which a post-hoc multiplier would break.
 */

/**
 * Below this the provider SILENTLY IGNORES the value and answers with
 * free-flow time. Measured one value at a time, 16 through 21:
 *
 *   16, 17, 18, 19 → 30 min (38.0 km/h)  ← the request may as well not exist
 *   20             → 66 min (17.0 km/h)
 *   21             → 64 min (17.6 km/h)
 *
 * Asking for slower than 20 therefore returns the FASTEST possible answer —
 * the exact opposite of the intent, with nothing in the response to say so.
 * Never send anything below this.
 */
export const PROVIDER_MIN_TOP_SPEED = 20;

/** Above this it stops being a city and the cap does nothing useful. */
export const PROVIDER_MAX_TOP_SPEED = 45;

/**
 * The caps, by what the roads are doing at that hour.
 *
 * Saigon peaks twice: the school-and-office run in the morning and the long
 * crawl home. These are the values whose measured outcomes bracket what riders
 * actually report — 17 km/h in the crush, 21 in ordinary daytime, 25 when the
 * streets are empty.
 */
export const RUSH_CAP = 20;
export const DAY_CAP = 24;
export const NIGHT_CAP = 32;

/** Rush hours as ranges of minutes-since-midnight, local time. */
const RUSH: ReadonlyArray<readonly [number, number]> = [
  [6 * 60 + 30, 8 * 60 + 30],
  [16 * 60 + 30, 19 * 60 + 30],
];

/** 22:00–05:00, when the cap can safely come off a little. */
const NIGHT_FROM = 22 * 60;
const NIGHT_TO = 5 * 60;

/** Which part of the day a local wall-clock time falls in. */
export function trafficBand(minutesOfDay: number): "rush" | "day" | "night" {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  if (m >= NIGHT_FROM || m < NIGHT_TO) return "night";
  return RUSH.some(([a, b]) => m >= a && m < b) ? "rush" : "day";
}

/**
 * The cap to send for a departure at this time, for riders this fast.
 *
 * `measuredKmh` is the couple's own average across their finished rides. It
 * beats the table whenever there is one: the table is a guess about a city,
 * that number is a fact about these two people and the roads they actually
 * take. Scaled by the band so a personal average gathered mostly at rush hour
 * does not then get applied to an empty midnight street.
 */
export function topSpeedFor(
  minutesOfDay: number,
  measuredKmh?: number | null,
): number {
  const band = trafficBand(minutesOfDay);
  const table = band === "rush" ? RUSH_CAP : band === "night" ? NIGHT_CAP : DAY_CAP;

  let cap = table;
  if (typeof measuredKmh === "number" && Number.isFinite(measuredKmh) && measuredKmh > 0) {
    /*
     * The cap is a TOP speed, not an average — a rider averaging 17 km/h
     * touches 30 on a clear stretch. The ratio comes from the measurement
     * above: a cap of 20 produced a 17.0 km/h average, so roughly 1.2.
     */
    const asCap = measuredKmh * 1.2;
    cap = band === "rush" ? asCap * 0.9 : band === "night" ? asCap * 1.3 : asCap;
  }
  return Math.round(Math.min(PROVIDER_MAX_TOP_SPEED, Math.max(PROVIDER_MIN_TOP_SPEED, cap)));
}

/** Minutes since local midnight for a Date, in a fixed zone offset (hours). */
export function minutesOfDayIn(date: Date, utcOffsetHours: number): number {
  const shifted = date.getTime() + utcOffsetHours * 3600_000;
  return Math.floor((shifted % 86_400_000) / 60_000);
}

/**
 * The couple's own average speed from finished rides, or null.
 *
 * Totals rather than a mean of per-ride speeds: one 200-metre hop that took
 * four minutes because somebody was parking would otherwise drag the average
 * down as hard as an hour on the road.
 *
 * Rides shorter than 800 m are dropped for the same reason, and anything
 * outside 5–60 km/h is treated as a recording artefact — a ride whose timer
 * kept running through lunch, or a tracker that woke up already at the
 * destination.
 */
export function averageRideKmh(
  rides: ReadonlyArray<{ distanceMeters: number; durationSeconds: number }>,
): number | null {
  let metres = 0;
  let seconds = 0;
  for (const r of rides) {
    if (!(r.distanceMeters >= 800) || !(r.durationSeconds > 0)) continue;
    const kmh = (r.distanceMeters / 1000) / (r.durationSeconds / 3600);
    if (!Number.isFinite(kmh) || kmh < 5 || kmh > 60) continue;
    metres += r.distanceMeters;
    seconds += r.durationSeconds;
  }
  // Three rides' worth of road before trusting it over the table.
  if (metres < 3000 || seconds <= 0) return null;
  return (metres / 1000) / (seconds / 3600);
}
