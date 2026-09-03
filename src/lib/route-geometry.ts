import type { LatLng } from "@/lib/maps";

/**
 * Where a live position sits on a drawn route.
 *
 * Lifted out of the navigation hook so it can be exercised on its own — this is
 * the arithmetic that decides "how far is left", "am I off the route" and, one
 * step further out, when to announce a turn. All of it is pure, and none of it
 * needs React to be checked.
 */

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Distance from point P to segment AB on an equirectangular approximation. */
export function distanceToSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { distance: number; projection: LatLng } {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * cosLat;
  const py = p.lat;
  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;

  const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
  if (l2 === 0) return { distance: haversineM(p, a), projection: a };

  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));

  const proj = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return { distance: haversineM(p, proj), projection: proj };
}

/**
 * Metres from the route's start to each vertex, built once per route.
 *
 * Turns "how far is left" from a walk down the rest of the polyline into one
 * subtraction. That walk ran on every GPS fix, and a 15km city route carries a
 * few thousand vertices, so it was thousands of haversines a second to answer a
 * question whose answer moves by a few metres.
 */
export function cumulativeMetres(coords: Array<[number, number]>): number[] {
  const out = new Array<number>(coords.length);
  out[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    out[i] =
      out[i - 1] +
      haversineM(
        { lat: coords[i - 1][1], lng: coords[i - 1][0] },
        { lat: coords[i][1], lng: coords[i][0] },
      );
  }
  return out;
}

/** How far ahead of the last match to look before giving up and scanning all. */
const MATCH_WINDOW_AHEAD = 200;
/** And a little behind, for a fix that lands slightly back down the road. */
const MATCH_WINDOW_BEHIND = 20;
/** Past this the window has clearly lost the route, so scan the whole thing. */
const WINDOW_TRUST_M = 120;

/**
 * Where on the route the person is, how far is left, and how far off it they are.
 *
 * Searched from where they were last, not from the start. A route is travelled
 * in one direction, so the segment being ridden is a handful along from the last
 * one — rediscovering that by scanning the entire polyline every second was the
 * costliest thing the navigation hook did, and it did it with the screen on and
 * the GPS streaming.
 *
 * The window is a shortcut, never a commitment: if the best match inside it is
 * further than WINDOW_TRUST_M then the route has genuinely been left — a wrong
 * turn, a tunnel, a fix that jumped — and the full scan runs, which is exactly
 * the moment being right matters more than being cheap.
 */
export function remainingAlongRoute(
  user: LatLng,
  coords: Array<[number, number]>,
  cum: number[],
  hintIdx = 0,
): { remaining: number; deviation: number; idx: number; projection: LatLng; bearing: number } {
  if (coords.length < 2)
    return { remaining: 0, deviation: 0, idx: 0, projection: user, bearing: 0 };

  const scan = (from: number, to: number) => {
    let bestIdx = from;
    let bestDist = Infinity;
    let bestProj = { lat: coords[from][1], lng: coords[from][0] };
    for (let i = from; i < to; i++) {
      const a = { lat: coords[i][1], lng: coords[i][0] };
      const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
      const { distance, projection } = distanceToSegment(user, a, b);
      if (distance < bestDist) {
        bestDist = distance;
        bestIdx = i;
        bestProj = projection;
      }
    }
    return { bestIdx, bestDist, bestProj };
  };

  const last = coords.length - 1;
  const from = Math.max(0, Math.min(hintIdx - MATCH_WINDOW_BEHIND, last - 1));
  const to = Math.min(last, hintIdx + MATCH_WINDOW_AHEAD);
  let m = scan(from, to);
  if (m.bestDist > WINDOW_TRUST_M) m = scan(0, last);

  // One subtraction instead of a walk: everything past the next vertex, plus
  // the stub from the projection to it.
  const toNextVertex = haversineM(m.bestProj, {
    lat: coords[m.bestIdx + 1][1],
    lng: coords[m.bestIdx + 1][0],
  });
  return {
    remaining: toNextVertex + Math.max(0, cum[last] - cum[m.bestIdx + 1]),
    deviation: m.bestDist,
    idx: m.bestIdx,
    // The point ON the road, and which way the road runs there. Both are what a
    // map should show while following a route: a raw fix wanders off the tarmac
    // by tens of metres and a compass reading spins while stopped at a light.
    projection: m.bestProj,
    bearing: bearingBetween(
      { lat: coords[m.bestIdx][1], lng: coords[m.bestIdx][0] },
      { lat: coords[m.bestIdx + 1][1], lng: coords[m.bestIdx + 1][0] },
    ),
  };
}

/**
 * Compass bearing from a to b, in degrees clockwise from north.
 *
 * Used for the direction of travel while snapped to a route. Taken from the
 * road's own geometry rather than the device: a phone in a pocket reports
 * whichever way it is lying, and a stationary rider's compass drifts in
 * circles, both of which spin the map for no reason.
 */
export function bearingBetween(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Which hand the destination is on, once you are facing the way you arrived. */
export type ArrivalSide = "left" | "right" | null;

/**
 * Which side of the road the destination sits on.
 *
 * Worth saying out loud because it is the one question left at the end of a
 * ride: the route ends where the road comes closest to the place, and the place
 * itself is a few metres off to one hand. A rider who is told which hand stops
 * once; a rider who is not looks both ways at walking pace in traffic.
 *
 * Compares the direction of travel over the last stretch of the line with the
 * direction from the line's end to the actual pin. `null` — say nothing — for
 * three cases where a claim would be worse than silence:
 *
 *   - the pin is essentially on the road, so neither hand is true
 *   - it is nearly straight ahead or straight behind, where a small error in
 *     either bearing flips the answer
 *   - there is not enough line left to establish which way the rider is facing
 *
 * The approach bearing is taken over about 25 m rather than from the final
 * segment, which can be a metre long and point anywhere.
 */
const APPROACH_M = 25;
/** Off the road by less than this and there is no side to speak of. */
const SIDE_MIN_OFFSET_M = 6;
/** Within this of dead ahead or dead behind, a side is not worth claiming. */
const SIDE_AMBIGUOUS_DEG = 25;

export function destinationSide(
  coords: Array<[number, number]>,
  destination: LatLng,
): ArrivalSide {
  if (coords.length < 2) return null;
  const at = (i: number): LatLng => ({ lat: coords[i][1], lng: coords[i][0] });
  const end = at(coords.length - 1);

  if (haversineM(end, destination) < SIDE_MIN_OFFSET_M) return null;

  // Walk back along the line until about APPROACH_M of it is behind us.
  let back = coords.length - 2;
  let walked = haversineM(at(back), end);
  while (back > 0 && walked < APPROACH_M) {
    back -= 1;
    walked = haversineM(at(back), end);
  }
  if (walked < 3) return null;

  const travel = bearingBetween(at(back), end);
  const toDest = bearingBetween(end, destination);
  // Signed difference in (-180, 180]: positive is clockwise, i.e. to the right.
  const delta = ((toDest - travel + 540) % 360) - 180;
  const off = Math.abs(delta);
  if (off < SIDE_AMBIGUOUS_DEG || off > 180 - SIDE_AMBIGUOUS_DEG) return null;
  return delta > 0 ? "right" : "left";
}

/**
 * How far off the route a fix may be and still be shown on it.
 *
 * Beyond this the rider genuinely is somewhere else — a parallel alley, a wrong
 * turn, a bridge over the road — and pinning the dot to the line would draw a
 * confident lie. GPS in a Vietnamese street canyon is commonly 15-25m out, so
 * this has to be loose enough to cover that and tight enough to let a real
 * deviation through.
 */
export const SNAP_MAX_M = 30;
