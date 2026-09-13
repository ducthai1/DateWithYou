/**
 * Deciding that a rider has actually left the route.
 *
 * One GPS fix is not evidence. At a junction — the exact place this matters —
 * a phone in a pocket between buildings reports fixes 40-60 m wide of the
 * truth, and the old rule ("deviation > 50 m") fired a re-route on the first
 * of them. What the rider saw was: turn correctly, watch the line redraw
 * around a road they were not on, then watch it redraw back a few seconds
 * later. Two wrong lines and two spoken announcements for a turn they got
 * right.
 *
 * Three things separate a real detour from noise, and all three are needed:
 *
 *   - **The fix has to be good enough to convict.** A fix that says
 *     "±50 m" cannot prove a 60 m deviation. The threshold is therefore not a
 *     constant: it grows with the reported accuracy.
 *   - **It has to persist.** A detour does not undo itself; noise does. Being
 *     off the line has to hold for several consecutive fixes AND for a stretch
 *     of time, so that a burst of bad fixes arriving quickly cannot pass for
 *     persistence.
 *   - **Coming back has to count.** A single fix back on the line resets
 *     everything, because that is what a corner cut wide looks like.
 *
 * Kept pure and away from React so it can be tested against a stream of fixes
 * in plain Node — see tests/unit/off-route.test.ts, which replays the junction
 * that caused this.
 */

/** Deviation beyond this is a detour no matter how poor the fix claims to be. */
export const OFF_ROUTE_HARD_M = 120;

/** The floor, used when the device reports no accuracy at all. */
export const OFF_ROUTE_BASE_M = 50;

/** Consecutive off-route fixes before a re-route is asked for. */
export const OFF_ROUTE_MIN_FIXES = 3;

/** …and they must span at least this long, so a burst cannot qualify. */
export const OFF_ROUTE_MIN_MS = 4_000;

export type OffRouteState = {
  /** Consecutive fixes that were off the line. */
  strikes: number;
  /** When the current run of strikes began. */
  since: number;
  /** True once a detour has been declared, until a fix lands back on the line. */
  declared: boolean;
};

export function initialOffRouteState(): OffRouteState {
  return { strikes: 0, since: 0, declared: false };
}

/**
 * How far off the line this fix must be before it counts as off at all.
 *
 * `accuracy` is a radius the device is fairly confident it is inside, so a
 * deviation smaller than it is equally well explained by the fix being wrong.
 * Requiring the deviation to clear the radius as well as the base threshold is
 * what stops a junction under tall buildings from looking like a detour.
 */
export function offRouteThreshold(accuracyM: number | null | undefined): number {
  const acc = typeof accuracyM === "number" && isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0;
  return Math.min(OFF_ROUTE_HARD_M, Math.max(OFF_ROUTE_BASE_M, acc * 1.5));
}

export type OffRouteInput = {
  /** Metres from the drawn line, as measured by the route geometry. */
  deviationM: number;
  /** The fix's own reported horizontal accuracy, if it gave one. */
  accuracyM: number | null | undefined;
  /** Monotonic-ish timestamp of this fix, in ms. */
  at: number;
};

export type OffRouteDecision = {
  state: OffRouteState;
  /** True exactly once per detour: the moment it becomes worth re-routing. */
  shouldReroute: boolean;
};

/**
 * Fold one GPS fix into the decision.
 *
 * Returns the next state and whether this fix is the one that tips it. It
 * fires ONCE per detour — `declared` stays set until a fix lands back on the
 * line — so a rider who is genuinely on a different road does not get a fresh
 * re-route every second while the first one is still being fetched.
 */
export function stepOffRoute(state: OffRouteState, input: OffRouteInput): OffRouteDecision {
  const { deviationM, accuracyM, at } = input;

  if (deviationM <= offRouteThreshold(accuracyM)) {
    // Back on the line. This is the common case at a junction, and it has to
    // wipe the slate — a corner cut wide is two bad fixes and then normality.
    return { state: initialOffRouteState(), shouldReroute: false };
  }

  /*
   * Unmistakably elsewhere: a wrong turn onto a road that runs away from this
   * one. No accuracy figure explains 120 m, and waiting four seconds to say so
   * means four seconds riding the wrong way.
   */
  if (deviationM > OFF_ROUTE_HARD_M) {
    return {
      state: { strikes: state.strikes + 1, since: state.since || at, declared: true },
      shouldReroute: !state.declared,
    };
  }

  const since = state.since || at;
  const strikes = state.strikes + 1;
  const persisted = strikes >= OFF_ROUTE_MIN_FIXES && at - since >= OFF_ROUTE_MIN_MS;

  return {
    state: { strikes, since, declared: state.declared || persisted },
    shouldReroute: persisted && !state.declared,
  };
}
