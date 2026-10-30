import { calculateDistance } from "@/lib/maps";
import type { TrackSample } from "@/lib/trip-split";

/**
 * How fast the two of them actually ride, by place and hour.
 *
 * The routing provider's free tier has no traffic: its time for cầu Sài Gòn at
 * 17:00 is the same as at 03:00. The only traffic data within reach is the
 * couple's own trips, now that the tracker records them with times — so each
 * finished trip is cut into ~440 m squares and the metres and seconds spent in
 * each square are added up, per hour of a weekday or weekend day.
 *
 * A route is then timed square by square, and trust in their history grows
 * with how much of it there is: one pass through a square on a rainy day
 * moves the estimate a third of the way, twenty passes nearly all of it. The
 * square's pace at any hour is weighed against the provider first, then this
 * hour's pace against that. With no history it is exactly the provider's
 * number, so it can only get better as trips accumulate.
 */

/** ~440 m north–south at Saigon's latitude, ~435 m east–west. */
export const CELL_DEG = 0.004;
/**
 * Metres of history at which it counts half. A square crossed once holds ~440 m,
 * so trust goes 0.3 → 0.7 → 0.9 over 1, 5 and 20 passes.
 */
export const TRUST_HALF_M = 1000;
export const ALL_HOURS = "all";
/** Pairs and route segments are cut this fine so each square gets its own share. */
const PIECE_M = 50;

/** Vietnam has one offset and no daylight saving; TZ names are unreliable on some hosts. */
const VN_OFFSET_MS = 7 * 3600_000;
/** Two fixes further apart than this in time: whatever happened between is not riding. */
const MAX_PAIR_GAP_MS = 120_000;
/** Faster than this between two fixes is a GPS jump. */
const MAX_PAIR_MPS = 40;
/** Clamp a learned pace to 5.4–144 km/h, whatever a thin sample says. */
const MIN_SEC_PER_M = 1 / 40;
const MAX_SEC_PER_M = 1 / 1.5;

export type CellTally = { m: number; s: number };

export function cellOf(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;
}

/** "wd17" — a weekday, 17:00–17:59 in Vietnam; "we" for Saturday and Sunday. */
export function hourBucket(at: number): string {
  const d = new Date(at + VN_OFFSET_MS);
  const day = d.getUTCDay();
  return `${day === 0 || day === 6 ? "we" : "wd"}${d.getUTCHours()}`;
}

export const tallyKey = (cell: string, bucket: string) => `${cell}|${bucket}`;

/** Metres and seconds per square and hour, from one finished trip. */
export function tallyTrip(points: TrackSample[]): Map<string, CellTally> {
  const out = new Map<string, CellTally>();
  const add = (key: string, m: number, s: number) => {
    const t = out.get(key) ?? { m: 0, s: 0 };
    t.m += m;
    t.s += s;
    out.set(key, t);
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dt = (b.at - a.at) / 1000;
    if (dt <= 0 || dt * 1000 > MAX_PAIR_GAP_MS) continue;
    const m = calculateDistance(a, b);
    if (m / dt > MAX_PAIR_MPS) continue;
    const bucket = hourBucket(a.at);
    // Fixes 170 m apart straddle squares; each square gets the part ridden in it.
    for (const piece of pieces(a, b, m)) {
      add(tallyKey(piece.cell, bucket), piece.share * m, piece.share * dt);
      add(tallyKey(piece.cell, ALL_HOURS), piece.share * m, piece.share * dt);
    }
  }
  return out;
}

/** The squares a straight stretch crosses, each with its fraction of the stretch. */
function pieces(a: { lat: number; lng: number }, b: { lat: number; lng: number }, m: number) {
  const n = Math.max(1, Math.ceil(m / PIECE_M));
  const out: Array<{ cell: string; share: number }> = [];
  for (let k = 0; k < n; k++) {
    const f = (k + 0.5) / n;
    const cell = cellOf(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f);
    const last = out[out.length - 1];
    if (last && last.cell === cell) last.share += 1 / n;
    else out.push({ cell, share: 1 / n });
  }
  return out;
}

/** Every square a route passes through, to fetch only those rows. */
export function cellsAlong(coords: Array<[number, number]>): string[] {
  const set = new Set<string>();
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][1], lng: coords[i - 1][0] };
    const b = { lat: coords[i][1], lng: coords[i][0] };
    for (const p of pieces(a, b, calculateDistance(a, b))) set.add(p.cell);
  }
  return [...set];
}

const trust = (t: CellTally | undefined) => (t && t.m > 0 ? t.m / (t.m + TRUST_HALF_M) : 0);
const paceOf = (t: CellTally) => Math.min(MAX_SEC_PER_M, Math.max(MIN_SEC_PER_M, t.s / t.m));

/**
 * The route's time with what they have learned folded in.
 *
 * `learnedShare` is how much of the answer is theirs rather than the map's —
 * the metre-weighted trust, 0 with no history, near 1 on roads they ride daily.
 */
export function learnedRouteSeconds(
  coords: Array<[number, number]>,
  providerSeconds: number,
  profile: Map<string, CellTally>,
  bucket: string,
): { seconds: number; learnedShare: number } {
  let totalM = 0;
  const segs: Array<{ m: number; cell: string }> = [];
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][1], lng: coords[i - 1][0] };
    const b = { lat: coords[i][1], lng: coords[i][0] };
    const m = calculateDistance(a, b);
    totalM += m;
    for (const p of pieces(a, b, m)) segs.push({ m: m * p.share, cell: p.cell });
  }
  if (totalM <= 0 || providerSeconds <= 0) return { seconds: providerSeconds, learnedShare: 0 };

  const basePace = providerSeconds / totalM;
  let seconds = 0;
  let trusted = 0;
  for (const { m, cell } of segs) {
    const any = profile.get(tallyKey(cell, ALL_HOURS));
    const hour = profile.get(tallyKey(cell, bucket));
    const wAny = trust(any);
    const cellPace = any && wAny > 0 ? wAny * paceOf(any) + (1 - wAny) * basePace : basePace;
    const wHour = trust(hour);
    const pace = hour && wHour > 0 ? wHour * paceOf(hour) + (1 - wHour) * cellPace : cellPace;
    seconds += m * pace;
    trusted += m * Math.max(wAny, wHour);
  }
  return { seconds: Math.round(seconds), learnedShare: trusted / totalM };
}
