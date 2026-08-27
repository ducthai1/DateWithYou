/**
 * How remaining distance and time are written, in one place.
 *
 * The full-screen HUD and the mini dock show the same two numbers, and a
 * journey that reads "1.2 km" in one corner and "1200 m" in the other looks
 * like two different journeys.
 */

/** Metres → "1.2 km" above a kilometre, "840 m" below it. */
export function fmtDistance(m: number | null): string {
  if (m == null) return "--";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** Seconds → "8 phút", or "1h 20p" once it passes an hour. Rounded up: arriving
 *  a minute later than promised is kinder than a minute earlier. */
export function fmtDuration(s: number | null): string {
  if (s == null) return "--";
  const mins = Math.ceil(s / 60);
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}p` : `${h}h`;
}
