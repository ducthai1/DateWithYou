/*
 * The day the app is named after.
 *
 * "Vivu No Plan" promises an afternoon you did not have to plan, and this is
 * the core that produces one: a skeleton of time slots first, then a place for
 * each slot. The order matters and is the whole design — matching places to
 * each other first is what produces three cafés in a row, or dinner at 15:00.
 *
 * Everything here is pure. No React, no network, no Mongoose: the caller hands
 * in the candidate places (and when each was last visited), and gets back a
 * draft. That is what makes the interesting behaviour — the recency penalty,
 * the opening-hours filter, the budget band, reproducibility from a seed —
 * testable at all.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSkeleton,
  planDay,
  kindOfCategory,
  costBandFor,
  SLOT_KINDS,
  type Candidate,
  type SlotKind,
} from "../../src/lib/day-planner.ts";

const DAY = 86_400_000;

/** A Tuesday, so the weekend template cannot fire by accident. */
const TUESDAY = "2026-09-15";
/** A Saturday. */
const SATURDAY = "2026-09-19";

let nextId = 0;
function place(over: Partial<Candidate> = {}): Candidate {
  nextId += 1;
  return {
    id: over.id ?? `p${nextId}`,
    name: over.name ?? `Quán ${nextId}`,
    category: "Cà phê",
    district: "Phường Sài Gòn",
    geo: { lat: 10.776, lng: 106.7 },
    rating: null,
    priceLevel: null,
    status: "want_to_go",
    mustTry: null,
    openTime: null,
    closeTime: null,
    source: "user",
    lastVisitedAt: null,
    ...over,
  };
}

/** A pool with a comfortable choice for every slot kind. */
function fullPool(perKind = 3): Candidate[] {
  const category: Record<SlotKind, string> = {
    meal: "Ăn tối",
    cafe: "Cà phê",
    drink: "Bar",
    stroll: "Công viên",
    entertain: "Rạp phim",
  };
  return SLOT_KINDS.flatMap((kind) =>
    Array.from({ length: perKind }, (_, i) =>
      place({ id: `${kind}-${i}`, name: `${kind} ${i}`, category: category[kind] }),
    ),
  );
}

function draftOf(req: Parameters<typeof planDay>[0], pool: Candidate[]) {
  const out = planDay(req, pool);
  assert.equal(out.ok, true, `expected a plan, got ${JSON.stringify(out)}`);
  return out as Extract<typeof out, { ok: true }>;
}

describe("the core stays pure", () => {
  test("it imports nothing that needs a browser, a server or a database", () => {
    /*
     * The one rule that keeps this file runnable in plain `node --test`, and
     * the one that is easiest to break by reaching for a model "just to look
     * up the last visit". The last-visit data is an INPUT; it is not fetched.
     */
    const src = readFileSync(new URL("../../src/lib/day-planner.ts", import.meta.url), "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      assert.ok(
        !/^(react|next|mongoose)|^@\/server|^@\/features|^@\/components/.test(spec),
        `day-planner must not import ${spec}`,
      );
    }
  });
});

describe("the skeleton comes before the places", () => {
  test("mid-afternoon gives the three-stop afternoon-into-evening shape", () => {
    const sk = buildSkeleton({ date: TUESDAY, startAt: "16:00" });
    assert.equal(sk.ok, true);
    if (!sk.ok) return;
    assert.equal(sk.name, "afternoon-evening");
    assert.deepEqual(sk.slots.map((s) => s.kind), ["cafe", "meal", "stroll"]);
    assert.equal(sk.slots[0].startTime, "16:00", "the first slot starts when you asked");
  });

  test("late evening gives two stops, not three", () => {
    // 21:00 with a three-stop template would run past midnight, which is how a
    // generator loses trust on its first use.
    const sk = buildSkeleton({ date: TUESDAY, startAt: "21:00" });
    assert.equal(sk.ok, true);
    if (!sk.ok) return;
    assert.equal(sk.name, "late-evening");
    assert.equal(sk.slots.length, 2);
    assert.deepEqual(sk.slots.map((s) => s.kind), ["meal", "drink"]);
  });

  test("a weekend lunchtime gives the long four-stop afternoon", () => {
    const sk = buildSkeleton({ date: SATURDAY, startAt: "12:00" });
    assert.equal(sk.ok, true);
    if (!sk.ok) return;
    assert.equal(sk.name, "weekend-long");
    assert.deepEqual(sk.slots.map((s) => s.kind), ["meal", "cafe", "entertain", "meal"]);
  });

  test("the same lunchtime on a workday is NOT the long shape", () => {
    // Proof the weekend template is actually gated on the day, not just on the
    // hour — otherwise the test above passes for the wrong reason.
    const sk = buildSkeleton({ date: TUESDAY, startAt: "12:00" });
    assert.equal(sk.ok, false);
  });

  test("three in the morning is refused, and says when to come back", () => {
    const sk = buildSkeleton({ date: TUESDAY, startAt: "03:00" });
    assert.equal(sk.ok, false);
    if (sk.ok) return;
    assert.equal(sk.reason, "outOfHours");
    assert.match(sk.nextStartAt, /^\d{2}:\d{2}$/, "a refusal must offer a time, not a dead end");
  });

  test("every template alternates — two stops of the same kind never touch", () => {
    for (const [date, startAt] of [
      [TUESDAY, "14:00"], [TUESDAY, "16:00"], [TUESDAY, "18:00"],
      [TUESDAY, "19:00"], [TUESDAY, "21:30"], [SATURDAY, "11:30"], [SATURDAY, "13:30"],
    ]) {
      const sk = buildSkeleton({ date, startAt });
      assert.equal(sk.ok, true, `${date} ${startAt} should produce a template`);
      if (!sk.ok) continue;
      for (let i = 1; i < sk.slots.length; i++) {
        assert.notEqual(
          sk.slots[i].kind, sk.slots[i - 1].kind,
          `${sk.name}: slot ${i} repeats ${sk.slots[i].kind}`,
        );
      }
      // And the clock only ever moves forward.
      for (let i = 1; i < sk.slots.length; i++) {
        assert.ok(sk.slots[i].startTime > sk.slots[i - 1].startTime, "slots must advance in time");
      }
    }
  });

  test("the bucket label agrees with the hour it sits at", () => {
    // A slot labelled "Tối" that starts at 15:00 would show the wrong icon all
    // the way through the UI; the label is derived, never typed in twice.
    const sk = buildSkeleton({ date: TUESDAY, startAt: "16:00" });
    if (!sk.ok) return;
    assert.equal(sk.slots[0].bucket, "afternoon");
    assert.equal(sk.slots.at(-1)?.bucket, "evening");
  });
});

describe("reading a space's own category names", () => {
  test("the app's default categories land on a sensible kind", () => {
    assert.equal(kindOfCategory("Cà phê"), "cafe");
    assert.equal(kindOfCategory("Ăn tối"), "meal");
    assert.equal(kindOfCategory("Street food"), "meal");
    assert.equal(kindOfCategory("Chụp ảnh"), "stroll");
    assert.equal(kindOfCategory("Workshop"), "entertain");
  });

  test("it reads names written without tone marks, as people type them", () => {
    assert.equal(kindOfCategory("ca phe"), "cafe");
    assert.equal(kindOfCategory("AN TOI"), "meal");
  });

  test("a name it does not recognise is null, not a wrong guess", () => {
    // Every space may rename these lists; guessing would quietly file a
    // bookshop under dinner.
    assert.equal(kindOfCategory("Khác"), null);
    assert.equal(kindOfCategory("Tiệm sách cũ"), null);
  });

  test("short words do not match inside longer ones", () => {
    // "ăn" must not match "bản đồ"; substring matching is the obvious
    // implementation and the wrong one.
    assert.notEqual(kindOfCategory("Bản đồ cổ"), "meal");
  });
});

describe("choosing a place for a slot", () => {
  test("a place closed at that hour is not offered", () => {
    /*
     * Only these two can serve dinner, and the shut one is rated HIGHER. That
     * is deliberate: with equal ratings the test passes whether or not the
     * filter exists, which is a test that proves nothing. Here the filter is
     * the only thing that can keep the 5-star place out.
     */
    const pool = [
      place({ id: "closed", category: "Ăn tối", rating: 5, openTime: "06:00", closeTime: "14:00" }),
      place({ id: "open", category: "Ăn tối", rating: 3, openTime: "10:00", closeTime: "23:00" }),
      ...fullPool().filter((p) => p.category !== "Ăn tối"),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, pool);
    const dinner = d.stops.find((s) => s.slot.kind === "meal");
    assert.equal(dinner?.place?.id, "open", "the place shut by dinner time must not be picked");
  });

  test("a place that never declared its hours is still usable, but says so", () => {
    /*
     * Most rows in this database have no opening hours at all. Treating
     * "unknown" as "closed" would empty the plan; treating it as "open" without
     * saying so would send someone to a locked door. It is offered, with a
     * warning attached to that stop.
     */
    const pool = [place({ id: "silent", category: "Ăn tối" }), ...fullPool()];
    const d = draftOf({ date: TUESDAY, startAt: "16:00", areas: [] }, pool);
    const dinner = d.stops.find((s) => s.slot.kind === "meal");
    assert.ok(dinner?.place, "a place with no hours must still be offered");
    assert.ok(
      dinner?.warnings.some((w) => /giờ/i.test(w)),
      `expected a soft warning about opening hours, got ${JSON.stringify(dinner?.warnings)}`,
    );
  });

  test("somewhere you went three days ago loses to somewhere you never have", () => {
    // Without this the generator returns the same top-rated places every time,
    // and is boring by the third use — which for this feature is fatal.
    const now = Date.UTC(2026, 8, 15);
    const pool = [
      place({ id: "just-been", category: "Ăn tối", rating: 5, lastVisitedAt: now - 3 * DAY }),
      place({ id: "never-been", category: "Ăn tối", rating: 4 }),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00", now }, pool);
    const dinner = d.stops.find((s) => s.slot.kind === "meal");
    assert.equal(dinner?.place?.id, "never-been", "the recency penalty must outweigh half a star");
  });

  test("the penalty wears off — a visit long ago stops counting", () => {
    const now = Date.UTC(2026, 8, 15);
    const pool = [
      place({ id: "old-favourite", category: "Ăn tối", rating: 5, lastVisitedAt: now - 200 * DAY }),
      place({ id: "unrated", category: "Ăn tối", rating: 3 }),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00", now }, pool);
    assert.equal(d.stops.find((s) => s.slot.kind === "meal")?.place?.id, "old-favourite");
  });

  test("a place you want to go beats one you have already ticked off", () => {
    const pool = [
      place({ id: "been", category: "Ăn tối", status: "visited", rating: 4 }),
      place({ id: "want", category: "Ăn tối", status: "want_to_go", rating: 4 }),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, pool);
    assert.equal(d.stops.find((s) => s.slot.kind === "meal")?.place?.id, "want");
  });

  test("no place is used twice in one day", () => {
    // The weekend template asks for two meals; the same restaurant for both
    // would be an obvious embarrassment.
    const pool = [
      place({ id: "only-meal-a", category: "Ăn tối" }),
      place({ id: "only-meal-b", category: "Ăn tối" }),
      ...fullPool(),
    ];
    const d = draftOf({ date: SATURDAY, startAt: "12:00" }, pool);
    const ids = d.stops.map((s) => s.place?.id).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `repeated a place: ${ids.join(", ")}`);
  });

  test("only the chosen areas are used", () => {
    const pool = [
      place({ id: "far", category: "Ăn tối", district: "Phường Thủ Đức", rating: 5 }),
      place({ id: "near", category: "Ăn tối", district: "Phường Sài Gòn", rating: 2 }),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00", areas: ["Phường Sài Gòn"] }, pool);
    assert.equal(d.stops.find((s) => s.slot.kind === "meal")?.place?.id, "near");
  });

  test("picking what is close keeps the day from zig-zagging", () => {
    /*
     * Two dinners of equal appeal, one beside the café and one across the
     * city. Nothing in ratings can separate them, so distance from the
     * previous stop is what has to.
     */
    const pool = [
      place({ id: "cafe", category: "Cà phê", geo: { lat: 10.776, lng: 106.700 } }),
      place({ id: "next-door", category: "Ăn tối", geo: { lat: 10.777, lng: 106.701 } }),
      place({ id: "across-town", category: "Ăn tối", geo: { lat: 10.850, lng: 106.800 } }),
      ...fullPool().filter((p) => p.category !== "Ăn tối" && p.category !== "Cà phê"),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, pool);
    assert.equal(d.stops.find((s) => s.slot.kind === "meal")?.place?.id, "next-door");
  });

  test("how far each hop is, is reported", () => {
    const pool = fullPool();
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, pool);
    assert.equal(d.stops[0].travelM, null, "there is nothing before the first stop");
    for (const s of d.stops.slice(1)) {
      assert.equal(typeof s.travelM, "number");
    }
  });
});

describe("when there is nothing to offer", () => {
  test("an empty space returns unfilled slots, and does not throw", () => {
    // Phase 2 fills these from Google; the core's job is to say which are
    // empty, calmly. Throwing here would turn a new couple's first tap into an
    // error screen.
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, []);
    assert.ok(d.stops.every((s) => s.unfilled));
    assert.deepEqual(d.unfilledKinds, d.stops.map((s) => s.slot.kind));
    assert.equal(d.stops.every((s) => s.place === null), true);
  });

  test("a partly-filled day keeps the stops it could fill", () => {
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, [place({ category: "Cà phê" })]);
    assert.equal(d.stops.filter((s) => !s.unfilled).length, 1);
    assert.ok(d.unfilledKinds.includes("meal"));
  });
});

describe("money is a range, never a number", () => {
  test("the band covers the sum of the stops it chose", () => {
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, fullPool());
    const min = d.stops.reduce((a, s) => a + s.cost.min, 0);
    const max = d.stops.reduce((a, s) => a + s.cost.max, 0);
    assert.equal(d.band.min, min);
    assert.equal(d.band.max, max);
    assert.ok(d.band.max > d.band.min, "a band with no width is a promise we cannot keep");
  });

  test("a cheap budget refuses the expensive places", () => {
    const pool = [
      place({ id: "pricey", category: "Ăn tối", priceLevel: 4, rating: 5 }),
      place({ id: "cheap", category: "Ăn tối", priceLevel: 1, rating: 3 }),
    ];
    const d = draftOf({ date: TUESDAY, startAt: "16:00", budget: "tiet-kiem" }, pool);
    assert.equal(d.stops.find((s) => s.slot.kind === "meal")?.place?.id, "cheap");
  });

  test("a place with no price is not excluded by a budget", () => {
    // Almost every hand-added row has no price level. Excluding them would
    // make the budget filter empty the plan for the people who use it most.
    const pool = [place({ id: "unknown-price", category: "Ăn tối" })];
    const d = draftOf({ date: TUESDAY, startAt: "16:00", budget: "tiet-kiem" }, pool);
    assert.equal(d.stops.find((s) => s.slot.kind === "meal")?.place?.id, "unknown-price");
  });

  test("dinner costs more than a walk", () => {
    assert.ok(costBandFor("meal", 2).max > costBandFor("stroll", 2).max);
  });
});

describe("the same question twice gives the same day", () => {
  test("same input and same seed is the same plan, field for field", () => {
    const pool = fullPool(4);
    const req = { date: TUESDAY, startAt: "16:00", seed: "abc" };
    assert.deepEqual(planDay(req, pool), planDay(req, pool));
  });

  test("a different seed can give a different day", () => {
    /*
     * "Đổi cho tôi cái khác" has to actually change something. With a pool of
     * equals the only thing that can separate them is the seed, so across a
     * handful of seeds we must see more than one answer.
     */
    const pool = Array.from({ length: 8 }, (_, i) =>
      place({ id: `equal-${i}`, category: "Ăn tối", rating: 4 }),
    );
    const picks = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((seed) => {
        const d = draftOf({ date: TUESDAY, startAt: "16:00", seed }, pool);
        return d.stops.find((s) => s.slot.kind === "meal")?.place?.id;
      }),
    );
    assert.ok(picks.size > 1, `every seed gave the same place: ${[...picks]}`);
  });

  test("the seed it used comes back with the plan", () => {
    // So "the same day again" is reproducible from what the client was shown.
    const d = draftOf({ date: TUESDAY, startAt: "16:00", seed: "xyz" }, fullPool());
    assert.equal(d.seed, "xyz");
  });
});

describe("what the person asked for is respected", () => {
  test("asking only for food drops the other slots", () => {
    const d = draftOf({ date: TUESDAY, startAt: "16:00", kinds: ["meal"] }, fullPool());
    assert.deepEqual(d.stops.map((s) => s.slot.kind), ["meal"]);
  });

  test("asking for something the template has none of keeps the template", () => {
    // Better a sensible day than an empty screen; the plan says so in words.
    const d = draftOf({ date: TUESDAY, startAt: "21:00", kinds: ["entertain"] }, fullPool());
    assert.ok(d.stops.length >= 2);
  });

  test("every stop carries a sentence saying why it is there", () => {
    const d = draftOf({ date: TUESDAY, startAt: "16:00" }, fullPool());
    for (const s of d.stops.filter((x) => !x.unfilled)) {
      assert.ok(s.reason.trim().length > 0, "a stop with no reason is just a list");
    }
  });
});
