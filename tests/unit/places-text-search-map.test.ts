/*
 * Turning Google's answer into rows this app can use.
 *
 * Every field here is optional on Google's side — a place can come back with
 * no price, no rating, no hours, and occasionally no coordinates at all. The
 * mapper's whole job is to survive that: skip what is unusable, keep what is
 * not, and never throw, because the caller is in the middle of building
 * somebody's evening.
 *
 * Runs from a fixture, never from the network. Note what the fixture says
 * about itself: it is shaped from the documented schema, not recorded from a
 * live call, because this machine has no API key. The shape is what is being
 * tested, so a real recorded body should drop straight in.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mapTextSearchResponse,
  priceLevelToNumber,
} from "../../src/lib/places-text-search-map.ts";

const BODY = JSON.parse(
  readFileSync(new URL("../fixtures/places-text-search.json", import.meta.url), "utf8"),
);

/** A Tuesday — Google numbers Sunday 0, so Tuesday is 2. */
const TUESDAY = 2;

describe("reading a Text Search body", () => {
  test("it keeps the places that are actually usable", () => {
    const out = mapTextSearchResponse(BODY, { weekday: TUESDAY });
    const ids = out.map((p) => p.externalId);
    assert.ok(ids.includes("ChIJexample0000000000000001"));
    assert.ok(ids.includes("ChIJexample0000000000000002"));
    assert.ok(ids.includes("ChIJexample0000000000000004"), "no price and no hours is still a place");
  });

  test("a place with no coordinates is dropped, not guessed at", () => {
    // A stop you cannot put on a map, measure a distance to, or navigate to is
    // not a stop. Nothing downstream can do anything with it.
    const out = mapTextSearchResponse(BODY, { weekday: TUESDAY });
    assert.ok(!out.some((p) => p.name === "Chỗ không có toạ độ"));
  });

  test("a place with no id is dropped", () => {
    // The id is the only thing that makes confirming the same plan twice
    // create one row instead of two.
    const out = mapTextSearchResponse(BODY, { weekday: TUESDAY });
    assert.ok(!out.some((p) => p.name === "Không có id"));
  });

  test("name, address and coordinates come through", () => {
    const [first] = mapTextSearchResponse(BODY, { weekday: TUESDAY });
    assert.equal(first.name, "Cà phê Vợt Phan Đình Phùng");
    assert.match(first.address ?? "", /Phan Đình Phùng/);
    assert.equal(first.geo.lat, 10.7905);
    assert.equal(first.geo.lng, 106.6842);
    assert.equal(first.rating, 4.4);
  });
});

describe("the price scale", () => {
  test("each documented level lands on its number", () => {
    assert.equal(priceLevelToNumber("PRICE_LEVEL_FREE"), 0);
    assert.equal(priceLevelToNumber("PRICE_LEVEL_INEXPENSIVE"), 1);
    assert.equal(priceLevelToNumber("PRICE_LEVEL_MODERATE"), 2);
    assert.equal(priceLevelToNumber("PRICE_LEVEL_EXPENSIVE"), 3);
    assert.equal(priceLevelToNumber("PRICE_LEVEL_VERY_EXPENSIVE"), 4);
  });

  test("unspecified and unknown mean no answer, not zero", () => {
    // Zero would read as "free" all the way through the budget band.
    assert.equal(priceLevelToNumber("PRICE_LEVEL_UNSPECIFIED"), null);
    assert.equal(priceLevelToNumber("SOMETHING_NEW"), null);
    assert.equal(priceLevelToNumber(undefined), null);
  });

  test("the older numeric form is still read", () => {
    // The legacy API answered with 0-4 directly; a recorded body from either
    // generation has to work.
    assert.equal(priceLevelToNumber(0), 0);
    assert.equal(priceLevelToNumber(4), 4);
    assert.equal(priceLevelToNumber(9), null);
  });

  test("it reaches the mapped place", () => {
    const out = mapTextSearchResponse(BODY, { weekday: TUESDAY });
    const cafe = out.find((p) => p.externalId === "ChIJexample0000000000000001");
    const grill = out.find((p) => p.externalId === "ChIJexample0000000000000002");
    assert.equal(cafe?.priceLevel, 1);
    assert.equal(grill?.priceLevel, 4);
  });
});

describe("opening hours for the day being planned", () => {
  test("the right weekday's period is the one taken", () => {
    const tue = mapTextSearchResponse(BODY, { weekday: TUESDAY })
      .find((p) => p.externalId === "ChIJexample0000000000000001");
    assert.equal(tue?.openTime, "06:30", "Tuesday opens half an hour later in the fixture");
    assert.equal(tue?.closeTime, "23:00");

    const mon = mapTextSearchResponse(BODY, { weekday: 1 })
      .find((p) => p.externalId === "ChIJexample0000000000000001");
    assert.equal(mon?.openTime, "06:00");
    assert.equal(mon?.closeTime, "22:30");
  });

  test("a place open past midnight keeps its wrapped window", () => {
    // 17:00-01:00 is normal for dinner here, and `isOpenAt` already knows how
    // to read a close time earlier than the open time. Dropping it because the
    // numbers look backwards would shut every late kitchen out of the evening.
    const grill = mapTextSearchResponse(BODY, { weekday: TUESDAY })
      .find((p) => p.externalId === "ChIJexample0000000000000002");
    assert.equal(grill?.openTime, "17:00");
    assert.equal(grill?.closeTime, "01:00");
  });

  test("hours for another day mean this day is unknown, not closed", () => {
    const grill = mapTextSearchResponse(BODY, { weekday: 0 })
      .find((p) => p.externalId === "ChIJexample0000000000000002");
    assert.equal(grill?.openTime, null);
    assert.equal(grill?.closeTime, null);
  });

  test("a half-written period is ignored rather than half-used", () => {
    const broken = mapTextSearchResponse(BODY, { weekday: TUESDAY })
      .find((p) => p.externalId === "ChIJexample0000000000000006");
    assert.ok(broken, "the place itself survives");
    assert.equal(broken?.openTime, null);
    assert.equal(broken?.closeTime, null);
  });
});

describe("bodies that are not what we asked for", () => {
  test("an error body, an empty body, or junk all give an empty list", () => {
    // Google answers a rejected key with a JSON error object, and a quota wall
    // with something else again. None of them may throw into the middle of
    // planning someone's evening.
    for (const body of [null, undefined, {}, { places: null }, { error: { code: 403 } }, [], "nope", 7]) {
      assert.deepEqual(mapTextSearchResponse(body, { weekday: TUESDAY }), []);
    }
  });

  test("one broken entry does not take the good ones with it", () => {
    const body = {
      places: [
        { id: "a", displayName: { text: "ổn" }, location: { latitude: 10.7, longitude: 106.7 } },
        null,
        { id: "b", displayName: null, location: { latitude: 10.8, longitude: 106.8 } },
        "rác",
      ],
    };
    const out = mapTextSearchResponse(body, { weekday: TUESDAY });
    assert.equal(out.length, 1);
    assert.equal(out[0].externalId, "a");
  });

  test("coordinates outside the world are refused", () => {
    const body = {
      places: [{ id: "x", displayName: { text: "xa quá" }, location: { latitude: 999, longitude: 0 } }],
    };
    assert.deepEqual(mapTextSearchResponse(body, { weekday: TUESDAY }), []);
  });
});
