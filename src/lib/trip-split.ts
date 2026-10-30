import { calculateDistance } from "@/lib/maps";

/**
 * Turning the tracker's stream of timed fixes into trips.
 *
 * Before the tracker, a ride existed only if someone pressed "dẫn đường", and
 * its trail had no times on it — so the ride over cầu Sài Gòn on 29/10 could
 * not even be replayed to see where the minutes went. Every OwnTracks fix
 * carries the phone's own clock, so the trip falls out of the data: moving
 * between two places where the phone sat still.
 *
 * A place counts as "sat still" after STOP_DWELL_MS within STOP_RADIUS_M. Long
 * enough that a red light, or a jam that crawls, does not cut one ride in two;
 * short enough that a quick stop for a drink is a stop.
 */

export type TrackSample = { at: number; lat: number; lng: number };

export type SplitTrip = {
  points: TrackSample[];
  distanceM: number;
  startedAt: number;
  endedAt: number;
};

export const STOP_RADIUS_M = 120;
export const STOP_DWELL_MS = 8 * 60_000;
/** No fix for this long: the phone was off, or still — either way the trip ended. */
export const GAP_MS = 10 * 60_000;
/** Shorter than this is walking to the car park, not a trip. */
export const MIN_TRIP_M = 1000;

export function pathMetres(points: TrackSample[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += calculateDistance(points[i - 1], points[i]);
  return m;
}

/**
 * The finished trips in `points`, and how far the data is settled.
 *
 * `settledUntil` is where the next pass should start reading: the departure of
 * a trip still under way, or the start of the stop the data ends in (so that
 * stop is seen whole next time and the next trip departs from its last point).
 * Null when nothing in `points` is settled yet.
 */
export function splitTrips(
  input: TrackSample[],
  now: number,
): { trips: SplitTrip[]; settledUntil: number | null } {
  const p = [...input].sort((a, b) => a.at - b.at);
  const n = p.length;
  if (n === 0) return { trips: [], settledUntil: null };

  // Mark the stops: a run of fixes that never strays STOP_RADIUS_M from where
  // it began, lasting at least STOP_DWELL_MS, with no gap inside it.
  const stay = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && p[j + 1].at - p[j].at <= GAP_MS && calculateDistance(p[i], p[j + 1]) <= STOP_RADIUS_M) j++;
    if (p[j].at - p[i].at >= STOP_DWELL_MS) {
      for (let k = i; k <= j; k++) stay[k] = true;
      i = j + 1;
    } else {
      i++;
    }
  }
  const gapBefore = (k: number) => k > 0 && p[k].at - p[k - 1].at > GAP_MS;

  const trips: SplitTrip[] = [];
  let settledUntil: number | null = null;
  let k = 0;
  while (k < n) {
    if (stay[k]) {
      k++;
      continue;
    }
    // A run of moving fixes, from k to e.
    let e = k;
    while (e + 1 < n && !stay[e + 1] && !gapBefore(e + 1)) e++;

    const from = k > 0 && stay[k - 1] && !gapBefore(k) ? k - 1 : k;
    const arrives = e + 1 < n && stay[e + 1] && !gapBefore(e + 1);
    const to = arrives ? e + 1 : e;
    const closed = e + 1 < n || now - p[e].at > GAP_MS;

    if (!closed) {
      settledUntil = p[from].at;
      return { trips, settledUntil };
    }
    const points = p.slice(from, to + 1);
    const distanceM = pathMetres(points);
    if (distanceM >= MIN_TRIP_M) {
      trips.push({ points, distanceM, startedAt: points[0].at, endedAt: points[points.length - 1].at });
    }
    settledUntil = arrives ? p[e + 1].at : p[e].at + 1;
    k = e + 1;
  }
  // Ends in a stop: the stop itself starts the next pass.
  if (stay[n - 1]) {
    let s = n - 1;
    while (s > 0 && stay[s - 1] && !gapBefore(s)) s--;
    settledUntil = p[s].at;
  }
  return { trips, settledUntil };
}
