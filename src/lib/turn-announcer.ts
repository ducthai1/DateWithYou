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

/*
 * Manoeuvre types that are lane guidance rather than a decision: bearing
 * slightly one way, keeping to a side, merging. On their own they are worth
 * saying; repeated along the road you are already on they are noise.
 */
const LANE_KEEPING = new Set([9, 16, 22, 23, 24, 25]);

/**
 * Only the turns worth interrupting for.
 *
 * Real turns and the arrival — and then a second pass that a real route made
 * necessary: a 10.9km ride across Saigon produced FOUR separate "chếch phải vào
 * Trường Chinh" instructions, because the router emits a manoeuvre wherever the
 * road changes shape and that road bends repeatedly. Being told to bear right
 * onto the street you have been riding along for two kilometres is not guidance.
 *
 * So a lane-keeping manoeuvre is dropped when it names the same street as the
 * last one kept. A real turn onto that street is never dropped, because turning
 * is a decision even when the name is familiar.
 */
export function announceableTurns(maneuvers: Maneuver[] | null): Maneuver[] {
  const real = (maneuvers ?? []).filter((m) => isRealTurn(m.type) || (m.type >= 4 && m.type <= 6));
  const kept: Maneuver[] = [];
  for (const m of real) {
    const street = m.streetNames.filter(Boolean)[0] ?? null;
    const lastStreet = kept.length ? (kept[kept.length - 1].streetNames.filter(Boolean)[0] ?? null) : null;
    if (LANE_KEEPING.has(m.type) && street && street === lastStreet) continue;
    kept.push(m);
  }
  return kept;
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
  /** Metres to it ALONG THE ROUTE when the route is known, straight line otherwise. */
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
  /**
   * How far the rider has come along this leg's polyline, in metres.
   *
   * Given, everything below is measured along the road. Absent — no route
   * matched yet, or a route cached before manoeuvres carried their offsets —
   * it falls back to straight lines, which is what this used to do everywhere
   * and is the reason it was wrong.
   */
  travelledM?: number | null,
): AnnouncerStep {
  if (turns.length === 0) return { state, speak: null, next: null, metres: null };

  const alongKnown =
    travelledM != null && turns.every((t) => typeof t.alongRouteMeters === "number");

  let idx = Math.min(state.idx, turns.length - 1);
  let metres: number;

  if (alongKnown) {
    /*
     * Which corner is next is decided by the rider's own progress along the
     * line, not by which corner happens to be nearest through the air.
     *
     * Measured against a real 7.8 km Saigon route that includes a U-turn on
     * Cộng Hòa. Straight lines got both jobs wrong there. The distances were
     * short by a fifth on ordinary bends — "500 mét" spoken with 608 m of road
     * left, "200 mét" with 296 — and around the U-turn they collapsed: every
     * corner after it sits a few metres from the road before it, so the
     * announcer locked onto a corner 1219 m ahead and said "rẽ phải NGAY" while
     * 751 m of road remained. Progress along the line is monotonic, so no
     * amount of doubling back can make a later corner look nearer.
     */
    const off = (i: number) => turns[i].alongRouteMeters as number;
    while (idx < turns.length - 1 && travelledM >= off(idx) - PASSED_M) idx += 1;
    metres = Math.max(0, off(idx) - travelledM);
  } else {
    /*
     * Catch up in one step, not one turn per fix.
     *
     * Advancing a single index per position fix means a rider who passes two
     * corners between fixes — a fast road, a sparse fix rate, a tunnel — spends
     * the next fixes counting down to corners already behind them. Settling the
     * index here costs a few comparisons and leaves the announcer describing
     * where they actually are. Bounded by the list length so it can never spin.
     */
    metres = haversineM(userGeo, { lat: turns[idx].lat, lng: turns[idx].lng });
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
