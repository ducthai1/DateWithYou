import type { LatLng } from "@/lib/maps";
import { haversineM } from "@/lib/route-geometry";
import { IMMINENT_M, isRealTurn, maneuverSentence, type Maneuver } from "@/lib/maneuver-vi";

/**
 * Deciding what to say next, as a pure step.
 *
 * Kept out of the React hook so a whole ride can be simulated against it — the
 * thing that most needs checking about spoken guidance is the SEQUENCE (does
 * each stage speak once, does it advance at the right moment, does it stay quiet
 * while creeping at a light), and none of that needs a browser to check.
 */

/** Metres at which each announcement is made, far to near. */
export const STAGES = [500, 200, 80, IMMINENT_M] as const;

/** Close enough to count the turn as taken and move to the next one. */
export const PASSED_M = 25;

/** Only the turns worth interrupting for: real turns, plus the arrival. */
export function announceableTurns(maneuvers: Maneuver[] | null): Maneuver[] {
  return (maneuvers ?? []).filter((m) => isRealTurn(m.type) || (m.type >= 4 && m.type <= 6));
}

export type AnnouncerState = {
  /** Index into the announceable turns. */
  idx: number;
  /** `${idx}:${stage}` for every stage already spoken. */
  said: ReadonlySet<string>;
};

export const initialAnnouncerState: AnnouncerState = { idx: 0, said: new Set() };

export type AnnouncerStep = {
  state: AnnouncerState;
  /** Non-null only on the step where it should be spoken. */
  speak: string | null;
  /** The turn being approached, for the banner. */
  next: Maneuver | null;
  /** Straight-line metres to it. */
  metres: number | null;
};

/**
 * Advance the announcer by one position fix.
 *
 * Deliberately says at most one thing per fix. Two instructions in the same
 * breath cannot both be heard, and the nearer one is always the one that
 * matters — so crossing two stages at once (a fast road, a sparse fix rate)
 * speaks the nearer and lets the further one lapse.
 */
export function stepAnnouncer(
  turns: Maneuver[],
  state: AnnouncerState,
  userGeo: LatLng,
): AnnouncerStep {
  if (turns.length === 0) return { state, speak: null, next: null, metres: null };

  /*
   * Catch up in one step, not one turn per fix.
   *
   * Advancing a single index per position fix means a rider who passes two
   * corners between fixes — a fast road, a sparse fix rate, a tunnel — spends
   * the next fixes counting down to corners already behind them. Settling the
   * index here costs a few comparisons and leaves the announcer describing
   * where they actually are. Bounded by the list length so it can never spin.
   */
  let idx = Math.min(state.idx, turns.length - 1);
  let metres = haversineM(userGeo, { lat: turns[idx].lat, lng: turns[idx].lng });
  for (let guard = 0; guard < turns.length && idx < turns.length - 1; guard++) {
    const ahead = turns[idx + 1];
    const toAhead = haversineM(userGeo, { lat: ahead.lat, lng: ahead.lng });
    if (metres <= PASSED_M || toAhead < metres) {
      idx += 1;
      metres = toAhead;
      continue;
    }
    break;
  }
  const advanced = idx !== state.idx;
  const turn = turns[idx];

  // Nothing more to say on the step that moved the pointer: the rider is being
  // told about the corner they are now approaching, not the one just left.
  if (advanced) {
    return { state: { idx, said: state.said }, speak: null, next: turn, metres };
  }

  /*
   * The NEAREST stage that has been crossed, not the first one that matches.
   *
   * STAGES runs far to near, so `find` returned 500 for every distance under
   * 500 — the key was always "idx:500", it was marked spoken on the first
   * announcement, and 200, 80 and 40 never fired. A whole ride said one sentence
   * per turn, half a kilometre before it, and then went silent at exactly the
   * point where the instruction was needed. `filter().at(-1)` takes the last —
   * the nearest — match.
   */
  const stage = STAGES.filter((s) => metres <= s).at(-1);
  if (stage == null) return { state: { idx, said: state.said }, speak: null, next: turn, metres };

  const key = `${idx}:${stage}`;
  if (state.said.has(key)) {
    return { state: { idx, said: state.said }, speak: null, next: turn, metres };
  }
  const said = new Set(state.said);
  said.add(key);
  return {
    state: { idx, said },
    speak: maneuverSentence(turn, metres),
    next: turn,
    metres,
  };
}
