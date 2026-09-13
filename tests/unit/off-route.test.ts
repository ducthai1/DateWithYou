/*
 * The junction that caused this.
 *
 * The old rule was one line — `deviation > 50` — and it fired a re-route on
 * the first bad fix. Riding it looked like: turn correctly, watch the line
 * redraw around a road you are not on, then watch it redraw back. These tests
 * replay that stream of fixes, so the shape of the noise is written down and
 * not just the threshold that survived it.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  initialOffRouteState,
  offRouteThreshold,
  stepOffRoute,
  OFF_ROUTE_BASE_M,
  OFF_ROUTE_HARD_M,
  type OffRouteInput,
  type OffRouteState,
} from "../../src/lib/off-route.ts";

/** Replay a stream of fixes, returning every moment a re-route was asked for. */
function replay(fixes: OffRouteInput[], from: OffRouteState = initialOffRouteState()) {
  let state = from;
  const fired: number[] = [];
  fixes.forEach((fix, i) => {
    const out = stepOffRoute(state, fix);
    state = out.state;
    if (out.shouldReroute) fired.push(i);
  });
  return { state, fired };
}

/** A fix every second, for brevity below. */
const stream = (specs: Array<[deviation: number, accuracy: number | null]>, startAt = 1_000_000) =>
  specs.map(([deviationM, accuracyM], i) => ({ deviationM, accuracyM, at: startAt + i * 1000 }));

describe("how far off counts as off", () => {
  test("a poor fix has to be further out before it means anything", () => {
    // A device saying "±50 m" cannot prove a 60 m deviation; one saying "±4 m"
    // can. The threshold follows the fix's own confidence.
    assert.equal(offRouteThreshold(4), OFF_ROUTE_BASE_M);
    assert.equal(offRouteThreshold(null), OFF_ROUTE_BASE_M);
    assert.equal(offRouteThreshold(undefined), OFF_ROUTE_BASE_M);
    assert.ok(offRouteThreshold(60) > OFF_ROUTE_BASE_M, "a ±60 m fix must demand more than 50 m");
    assert.equal(offRouteThreshold(60), 90);
  });

  test("it never demands more than the hard limit", () => {
    // An absurd accuracy reading must not make the rider unrerouteable.
    assert.equal(offRouteThreshold(10_000), OFF_ROUTE_HARD_M);
  });

  test("a nonsense accuracy falls back to the floor", () => {
    assert.equal(offRouteThreshold(-5), OFF_ROUTE_BASE_M);
    assert.equal(offRouteThreshold(NaN), OFF_ROUTE_BASE_M);
  });
});

describe("the junction", () => {
  test("one wide fix mid-turn does not redraw the route", () => {
    /*
     * What actually happened: turning right at a junction under buildings, one
     * fix lands 60 m out with a ±45 m accuracy, and the next is back on the
     * line. The old rule re-routed here — twice, because the second line was
     * wrong too.
     */
    const { fired } = replay(stream([
      [8, 6],
      [60, 45],
      [11, 8],
      [9, 7],
    ]));
    assert.deepEqual(fired, [], "a single wide fix is noise, not a detour");
  });

  test("a burst of three bad fixes in one second is still noise", () => {
    // Count alone is not persistence: a phone can emit several bad fixes in a
    // moment while it reacquires. They have to span real time too.
    const fixes = [
      { deviationM: 70, accuracyM: 30, at: 1_000_000 },
      { deviationM: 75, accuracyM: 30, at: 1_000_300 },
      { deviationM: 72, accuracyM: 30, at: 1_000_600 },
      { deviationM: 9, accuracyM: 6, at: 1_001_000 },
    ];
    assert.deepEqual(replay(fixes).fired, []);
  });

  test("coming back on the line wipes the strikes", () => {
    const { state } = replay(stream([
      [70, 20],
      [72, 20],
      [10, 8],
    ]));
    assert.deepEqual(state, initialOffRouteState(), "one good fix resets everything");
  });
});

describe("a real detour", () => {
  test("persisting long enough does ask for a new route, once", () => {
    /*
     * At one fix a second this is five fixes: three strikes is reached at the
     * third, but the four-second clock only runs out at the fifth. Both have
     * to clear, which is the point — the count alone would let a fast burst
     * through.
     */
    const { fired } = replay(stream([
      [8, 6],
      [70, 20],  // strike 1, clock starts
      [74, 20],  // strike 2, +1s
      [80, 20],  // strike 3, +2s — count met, clock not
      [85, 20],  // strike 4, +3s
      [90, 20],  // strike 5, +4s — both met
    ]));
    assert.deepEqual(fired, [5], "fires on the fix that clears both the count and the clock");
  });

  test("it does not ask again while still off the line", () => {
    // A second request would be sent while the first is still being fetched,
    // from a point the rider has already left.
    const { fired } = replay(stream([
      [70, 20], [74, 20], [80, 20], [85, 20],
      [92, 20], [100, 20], [110, 20], [118, 20],
    ]));
    assert.equal(fired.length, 1, `asked ${fired.length} times, expected exactly one`);
  });

  test("rejoining and leaving again is a second detour", () => {
    const { fired } = replay(stream([
      [70, 20], [74, 20], [80, 20], [85, 20], [90, 20],  // detour one
      [9, 7],                                            // back on the line
      [70, 20], [74, 20], [80, 20], [85, 20], [90, 20],  // detour two
    ]));
    assert.equal(fired.length, 2, `each detour earns its own re-route (fired ${fired.length}×)`);
  });

  test("a wrong turn far from the line does not wait four seconds", () => {
    /*
     * 120 m is not explainable by any accuracy figure — it is a different
     * road, running away from this one. Waiting for persistence there means
     * four more seconds riding the wrong way.
     */
    const { fired } = replay(stream([
      [10, 8],
      [300, 25],
    ]));
    assert.deepEqual(fired, [1], "an unmistakable detour reroutes at once");
  });

  test("even the unmistakable case only fires once", () => {
    const { fired } = replay(stream([[300, 25], [340, 25], [380, 25]]));
    assert.equal(fired.length, 1);
  });
});

describe("what the old rule would have done", () => {
  test("the noisy junction used to trip the plain 50 m test", () => {
    // Proof that the fixture is a real regression case and not a stream the
    // old code would have handled anyway.
    const junction = stream([[8, 6], [60, 45], [11, 8], [9, 7]]);
    const oldRuleFired = junction.filter((f) => f.deviationM > 50).length;
    assert.equal(oldRuleFired, 1, "the old rule re-routed here");
    assert.deepEqual(replay(junction).fired, [], "the new one does not");
  });
});
