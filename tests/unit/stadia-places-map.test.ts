/*
 * Reading a geocoder's answer when what you wanted was a category search.
 *
 * Stadia's free plan needs no payment method, which is the only reason this
 * provider exists — but Pelias matches NAMES and its response carries no
 * category at all. The fixture beside this file is a real recorded answer, and
 * it contains the real rubbish: searching "quán ăn" with `categories=food`
 * genuinely returns a district party office and a crocodile.
 *
 * So most of this file is about what gets thrown away.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapStadiaResponse } from "../../src/lib/stadia-places-map.ts";
import { openingWindowFor } from "../../src/lib/osm-opening-hours.ts";

const FIXTURE = JSON.parse(
  readFileSync(new URL("../fixtures/stadia-places.json", import.meta.url), "utf8"),
) as { queries: Record<string, unknown> };

/** A Tuesday. Google and OSM both number Sunday 0. */
const TUESDAY = 2;
const named = (list: { name: string }[]) => list.map((p) => p.name);

describe("what survives, from a real answer", () => {
  test("cafés come through with their coordinates", () => {
    const out = mapStadiaResponse(FIXTURE.queries.cafe, { weekday: TUESDAY, kind: "cafe" });
    assert.ok(out.length >= 3, `expected several cafés, got ${out.length}`);
    assert.ok(out.every((p) => p.geo.lat !== 0 && p.geo.lng !== 0));
    assert.ok(out.every((p) => p.externalId), "an id is what makes confirming idempotent");
    assert.ok(named(out).some((n) => /Cà Phê|Cà phê/.test(n)));
  });

  test("every kind finds something", () => {
    for (const [kind, key] of [
      ["cafe", "cafe"], ["meal", "meal"], ["drink", "drink"],
      ["stroll", "stroll"], ["entertain", "entertain"],
    ] as const) {
      const out = mapStadiaResponse(FIXTURE.queries[key], { weekday: TUESDAY, kind });
      assert.ok(out.length > 0, `${kind} found nothing usable`);
    }
  });
});

describe("what gets thrown away", () => {
  test("a district party office is not a restaurant", () => {
    /*
     * This is in the fixture because the live API really answered "quán ăn"
     * with it — "quán", "quận" and "quân" are one fold apart. Nothing in the
     * response says it is not a restaurant; only its name does.
     */
    const out = mapStadiaResponse(FIXTURE.queries.meal, { weekday: TUESDAY, kind: "meal" });
    assert.ok(!named(out).some((n) => /Quận ủy|BCH Quân sự/.test(n)), named(out).join(" · "));
  });

  test("and a crocodile is not a café", () => {
    const out = mapStadiaResponse(FIXTURE.queries.cafe, { weekday: TUESDAY, kind: "cafe" });
    assert.ok(!named(out).some((n) => /Cá sấu/.test(n)));
  });

  test("a restaurant is not offered for the coffee slot", () => {
    // "Nhà Hàng Út Cà Mau" matched a search for "cà phê" only because of the
    // "Cà" in "Cà Mau". It is a real place — just not this kind of place.
    const out = mapStadiaResponse(FIXTURE.queries.cafe, { weekday: TUESDAY, kind: "cafe" });
    assert.ok(!named(out).some((n) => /Nhà Hàng/.test(n)));
  });

  test("asking for the wrong kind of the same answer gives nothing", () => {
    // The strongest form of the filter: hand it the park results and ask for
    // dinner. Everything must go.
    const out = mapStadiaResponse(FIXTURE.queries.stroll, { weekday: TUESDAY, kind: "meal" });
    assert.deepEqual(out, []);
  });

  test("the same venue listed twice is listed once", () => {
    const body = {
      features: [1, 2].map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [106.7009, 10.7769] },
        properties: { name: "Cà phê Trùng", gid: `openstreetmap:venue:node/${i}` },
      })),
    };
    assert.equal(mapStadiaResponse(body, { weekday: TUESDAY, kind: "cafe" }).length, 1);
  });
});

describe("bodies that are not what we asked for", () => {
  test("junk gives an empty list rather than throwing", () => {
    for (const body of [null, undefined, {}, { features: null }, [], "nope", 7]) {
      assert.deepEqual(mapStadiaResponse(body, { weekday: TUESDAY, kind: "cafe" }), []);
    }
  });

  test("a feature with no coordinates is dropped", () => {
    const body = { features: [{ properties: { name: "Cà phê Không Đâu", gid: "x" } }] };
    assert.deepEqual(mapStadiaResponse(body, { weekday: TUESDAY, kind: "cafe" }), []);
  });

  test("a feature with no id is dropped", () => {
    // Without an id, confirming the same plan twice would save it twice.
    const body = {
      features: [{
        geometry: { type: "Point", coordinates: [106.7, 10.77] },
        properties: { name: "Cà phê Vô Danh" },
      }],
    };
    assert.deepEqual(mapStadiaResponse(body, { weekday: TUESDAY, kind: "cafe" }), []);
  });
});

describe("rating and price are left unknown, not invented", () => {
  test("both come back null for every result", () => {
    /*
     * There is no source of real ratings or price levels that is both free and
     * usable without a card — Foursquare puts them behind a premium tier,
     * TripAdvisor wants a card, and the OSM-derived providers have neither. So
     * they stay null, and the planner does what it already does with unknowns:
     * score the place as average, and price the stop by what that kind of stop
     * usually costs.
     */
    const out = mapStadiaResponse(FIXTURE.queries.cafe, { weekday: TUESDAY, kind: "cafe" });
    assert.ok(out.every((p) => p.rating === null && p.priceLevel === null));
  });
});

describe("opening hours, from the OSM tag", () => {
  const w = (tag: string, day = TUESDAY) => openingWindowFor(tag, day);

  test("the everyday shapes are read", () => {
    assert.deepEqual(w("Mo-Su 10:00-23:00"), { openTime: "10:00", closeTime: "23:00" });
    assert.deepEqual(w("Mo-Fr 08:00-17:00"), { openTime: "08:00", closeTime: "17:00" });
    assert.deepEqual(w("24/7"), { openTime: "00:00", closeTime: "23:59" });
    assert.deepEqual(w("10:00-22:00"), { openTime: "10:00", closeTime: "22:00" });
  });

  test("a kitchen open past midnight keeps its wrapped window", () => {
    // 18:00-05:00 is normal here, and `isOpenAt` already reads a close time
    // earlier than the open time as running past midnight.
    assert.deepEqual(w("Mo-Su 18:00-05:00"), { openTime: "18:00", closeTime: "05:00" });
  });

  test("the rule for the right day is the one taken", () => {
    const tag = "Mo-Fr 08:00-17:00; Sa 09:00-12:00";
    assert.deepEqual(w(tag, 2), { openTime: "08:00", closeTime: "17:00" });
    assert.deepEqual(w(tag, 6), { openTime: "09:00", closeTime: "12:00" });
    assert.equal(w(tag, 0), null, "Sunday is in neither rule, so it is unknown");
  });

  test("a day list is read as a list", () => {
    assert.deepEqual(w("Sa,Su 09:00-22:00", 6), { openTime: "09:00", closeTime: "22:00" });
    assert.equal(w("Sa,Su 09:00-22:00", 3), null);
  });

  test("anything it does not understand is unknown, never a guess", () => {
    /*
     * The full syntax is a small language — sunset offsets, public holidays,
     * week numbers, comments. Reading those badly does not produce an error,
     * it produces somebody standing in front of a locked door. Null means "we
     * do not know", which the card already says out loud.
     */
    for (const tag of [
      "sunrise-sunset",
      "Mo-Fr 08:00-12:00,13:00-17:00",
      'Mo-Su 10:00-22:00; PH off',
      "Jan-Mar 09:00-17:00",
      "Mo-Su 10:00+",
      "",
      "xin chào",
    ]) {
      assert.equal(w(tag), null, `"${tag}" should not have been understood`);
    }
  });

  test("a closure rule is skipped rather than read as a window", () => {
    assert.deepEqual(w("Mo-Sa 09:00-18:00; Su off", 1), { openTime: "09:00", closeTime: "18:00" });
    assert.equal(w("Mo-Sa 09:00-18:00; Su off", 0), null);
  });

  test("a non-string tag is unknown", () => {
    for (const tag of [null, undefined, 7, {}, []]) {
      assert.equal(openingWindowFor(tag, TUESDAY), null);
    }
  });
});
