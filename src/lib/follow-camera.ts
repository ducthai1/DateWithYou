/**
 * Deciding when the map should actually move while following a rider.
 *
 * Measured, not guessed: on a production build at phone-class CPU, the riding
 * screen spent 6,507 ms of 30 seconds inside MapLibre's label-collision pass
 * against React's 524 ms, and layout was 41 ms — the DOM was never the
 * problem. Standing still the same screen cost *nothing*: 0 animation frames,
 * main thread 96% idle. Every millisecond appeared only while the camera was
 * moving, because the follow effect restarted a 600 ms `easeTo` on **every**
 * GPS fix. At one fix a second that leaves the camera animating about 60% of
 * the time, and every animating frame re-runs the placement pass.
 *
 * So the cheapest fix is to move the camera less often, and this decides when:
 *
 *   - **A fix that barely moved is not movement.** Stopped at a light, a phone
 *     reports a new position every second that wanders a few metres. Re-aiming
 *     at it animates the camera for nothing.
 *   - **A heading that barely turned is not a turn.** Rotating the map by three
 *     degrees costs a full placement pass and is invisible to the rider.
 *   - **Never animate for longer than the gap to the next fix.** If the next
 *     one arrives in a second, a 600 ms glide ends with time to spare; a longer
 *     one would still be running when the next fix restarts it, so the camera
 *     would never come to rest at all.
 *
 * Pure and away from React so the arithmetic can be replayed against a stream
 * of fixes — see tests/unit/follow-camera.test.ts. Same shape as
 * `src/lib/off-route.ts`, and for the same reason.
 */
import { haversineM } from "@/lib/route-geometry";

export type LatLng = { lat: number; lng: number };

/** Below this, a new fix is jitter rather than travel. */
export const MIN_MOVE_M = 6;
/** Below this, a new heading is noise rather than a turn. */
export const BEARING_DEADBAND_DEG = 8;
/** The glide never lasts longer than this, however slow the fixes are. */
export const MAX_EASE_MS = 600;
/** …nor shorter than this, or it reads as a jump rather than a follow. */
export const MIN_EASE_MS = 220;

export type FollowState = {
  /** Where the camera was last aimed. */
  geo: LatLng | null;
  /** The bearing last applied, so small turns can be ignored against it. */
  bearing: number | null;
  /** When the last move was ordered, for sizing the next glide. */
  at: number;
};

export type FollowFix = { geo: LatLng; heading: number | null; at: number };

export type FollowMove = {
  center: [lng: number, lat: number];
  /** Omitted when the turn was too small to be worth a rotation. */
  bearing?: number;
  durationMs: number;
};

export function initialFollowState(): FollowState {
  return { geo: null, bearing: null, at: 0 };
}

/** Smallest angle between two bearings, 0–180. */
export function bearingDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Fold one fix into the camera decision.
 *
 * Returns `move: null` when the map should be left alone — which, riding a
 * real street, is most of the fixes.
 */
export function stepFollow(
  state: FollowState,
  fix: FollowFix,
): { state: FollowState; move: FollowMove | null } {
  const first = state.geo === null;
  const movedM = state.geo ? haversineM(state.geo, fix.geo) : Infinity;
  const turned =
    typeof fix.heading === "number" && Number.isFinite(fix.heading)
      ? state.bearing === null || bearingDelta(fix.heading, state.bearing) > BEARING_DEADBAND_DEG
      : false;

  // Neither travelled nor turned: the best thing the map can do is nothing.
  if (!first && movedM < MIN_MOVE_M && !turned) return { state, move: null };

  /*
   * Size the glide to the gap between fixes, so one animation finishes before
   * the next begins. A camera that is always mid-glide is a camera that never
   * stops re-running the placement pass, which is the whole bug.
   */
  const gap = state.at ? fix.at - state.at : MAX_EASE_MS;
  const durationMs = first
    ? MIN_EASE_MS
    : Math.max(MIN_EASE_MS, Math.min(MAX_EASE_MS, Math.round(gap * 0.6)));

  const bearing = turned ? (fix.heading as number) : undefined;
  return {
    state: {
      geo: fix.geo,
      bearing: bearing ?? state.bearing,
      at: fix.at,
    },
    move: {
      center: [fix.geo.lng, fix.geo.lat],
      ...(bearing === undefined ? {} : { bearing }),
      durationMs,
    },
  };
}
