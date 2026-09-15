/*
 * The camera that would not stop moving.
 *
 * A rider reported the map freezing mid-journey while the spoken directions
 * kept going. Profiling found no mystery: MapLibre re-runs its label-collision
 * pass on every animating frame, the follow effect restarted a 600 ms glide on
 * every GPS fix, and at one fix a second that left the camera in motion about
 * 60% of the time. Standing still, the same screen cost nothing at all.
 *
 * These tests replay streams of fixes — a rider stopped at a light, a rider
 * going straight, a rider turning — and pin when the map is allowed to move.
 * The unit under test is the decision, not the drawing.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  bearingDelta,
  initialFollowState,
  stepFollow,
  BEARING_DEADBAND_DEG,
  MAX_EASE_MS,
  MIN_EASE_MS,
  type FollowFix,
  type FollowState,
} from "../../src/lib/follow-camera.ts";

const AT = { lat: 10.7769, lng: 106.7009 };

/** Metres north of the origin, roughly. */
const north = (m: number) => ({ lat: AT.lat + m / 111_320, lng: AT.lng });

function replay(fixes: FollowFix[], from: FollowState = initialFollowState()) {
  let state = from;
  const moves: Array<{ i: number; durationMs: number; bearing?: number }> = [];
  fixes.forEach((fix, i) => {
    const out = stepFollow(state, fix);
    state = out.state;
    if (out.move) moves.push({ i, durationMs: out.move.durationMs, bearing: out.move.bearing });
  });
  return { state, moves };
}

describe("the angle helper", () => {
  test("it takes the short way round", () => {
    assert.equal(bearingDelta(10, 350), 20, "10° and 350° are 20° apart, not 340°");
    assert.equal(bearingDelta(0, 180), 180);
    assert.equal(bearingDelta(95, 90), 5);
  });
});

describe("standing still", () => {
  test("a phone wandering a few metres at a red light moves nothing", () => {
    /*
     * This is the case that mattered most. Stopped, a phone still emits a fix
     * every second and each one lands a few metres from the last — so the old
     * effect animated the camera continuously while the bike was not moving at
     * all, and every one of those frames re-ran label placement.
     */
    const first = { geo: AT, heading: 90, at: 1_000_000 };
    const { state } = replay([first]);
    const jitter = Array.from({ length: 10 }, (_, i) => ({
      geo: { lat: AT.lat + (i % 3) / 111_320, lng: AT.lng + ((i + 1) % 3) / 111_320 },
      heading: 90 + (i % 2),
      at: 1_000_000 + (i + 1) * 1000,
    }));
    assert.deepEqual(replay(jitter, state).moves, [], "not one of those is movement");
  });

  test("the very first fix always aims the camera", () => {
    const { moves } = replay([{ geo: AT, heading: null, at: 1_000_000 }]);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].durationMs, MIN_EASE_MS, "no glide from nowhere");
  });
});

describe("actually going somewhere", () => {
  test("real travel moves the camera every time", () => {
    const fixes = Array.from({ length: 5 }, (_, i) => ({
      geo: north(i * 25),
      heading: 0,
      at: 1_000_000 + i * 1000,
    }));
    assert.equal(replay(fixes).moves.length, 5);
  });

  test("the glide is shorter than the gap to the next fix", () => {
    /*
     * The point of the whole file. If the animation outlasts the gap, the next
     * fix restarts it and the camera never comes to rest — which is the state
     * that costs 6.5 seconds of placement work in 30.
     */
    const gap = 1000;
    const fixes = Array.from({ length: 4 }, (_, i) => ({
      geo: north(i * 30),
      heading: 0,
      at: 1_000_000 + i * gap,
    }));
    for (const m of replay(fixes).moves.slice(1)) {
      assert.ok(m.durationMs < gap, `glide ${m.durationMs}ms would still be running at the next fix`);
    }
  });

  test("slow fixes still do not glide forever", () => {
    const fixes = [
      { geo: AT, heading: 0, at: 1_000_000 },
      { geo: north(60), heading: 0, at: 1_010_000 },
    ];
    const [, second] = replay(fixes).moves;
    assert.equal(second.durationMs, MAX_EASE_MS, "capped, however long the gap was");
  });

  test("fast fixes do not produce a jump", () => {
    const fixes = [
      { geo: AT, heading: 0, at: 1_000_000 },
      { geo: north(20), heading: 0, at: 1_000_100 },
    ];
    const [, second] = replay(fixes).moves;
    assert.equal(second.durationMs, MIN_EASE_MS, "floored, so it still reads as a follow");
  });
});

describe("turning", () => {
  test("a few degrees of compass noise does not rotate the map", () => {
    // Rotating costs a full placement pass and is invisible at this size.
    const start = { geo: AT, heading: 90, at: 1_000_000 };
    const { state } = replay([start]);
    const wobble = Array.from({ length: 6 }, (_, i) => ({
      geo: AT,
      heading: 90 + (i % 2 ? BEARING_DEADBAND_DEG - 2 : -(BEARING_DEADBAND_DEG - 2)),
      at: 1_000_000 + (i + 1) * 1000,
    }));
    assert.deepEqual(replay(wobble, state).moves, []);
  });

  test("a real turn does rotate it", () => {
    const { state } = replay([{ geo: AT, heading: 0, at: 1_000_000 }]);
    const { moves } = replay([{ geo: AT, heading: 90, at: 1_001_000 }], state);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].bearing, 90);
  });

  test("a turn on the spot is still worth following", () => {
    // Waiting to turn left: the bike has not moved, but where it points has.
    const { state } = replay([{ geo: AT, heading: 0, at: 1_000_000 }]);
    const { moves } = replay([{ geo: AT, heading: 45, at: 1_001_000 }], state);
    assert.equal(moves.length, 1, "a turn counts even when the position does not");
  });

  test("a move with no turn carries no bearing at all", () => {
    /*
     * Not a detail: passing the same bearing back to MapLibre still counts as
     * a rotation to animate. Leaving it out is what lets the camera pan
     * without re-projecting every label on screen.
     */
    const { state } = replay([{ geo: AT, heading: 90, at: 1_000_000 }]);
    const { moves } = replay([{ geo: north(30), heading: 91, at: 1_001_000 }], state);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].bearing, undefined);
  });

  test("a device with no compass never rotates", () => {
    const fixes = Array.from({ length: 4 }, (_, i) => ({
      geo: north(i * 30),
      heading: null,
      at: 1_000_000 + i * 1000,
    }));
    assert.ok(replay(fixes).moves.every((m) => m.bearing === undefined));
  });
});

describe("how much less the camera moves", () => {
  test("a realistic minute of riding orders far fewer moves than fixes", () => {
    /*
     * The old code ordered one glide per fix, always. This replays a minute of
     * city riding — some travel, two stops at lights, compass noise throughout
     * — and asserts the camera is left alone for a good part of it. The exact
     * number is not the point; the ratio is.
     */
    const fixes: FollowFix[] = [];
    let metres = 0;
    for (let i = 0; i < 60; i++) {
      const stopped = (i >= 15 && i < 30) || (i >= 45 && i < 55);
      if (!stopped) metres += 8;
      fixes.push({
        geo: { lat: AT.lat + metres / 111_320, lng: AT.lng + (i % 3) / 400_000 },
        heading: 90 + (i % 2 ? 3 : -3),
        at: 1_000_000 + i * 1000,
      });
    }
    const { moves } = replay(fixes);
    assert.ok(moves.length < fixes.length * 0.7, `${moves.length}/60 moves is not much of a saving`);
    assert.ok(moves.length > 20, `${moves.length}/60 would mean the map stopped following`);
  });
});
