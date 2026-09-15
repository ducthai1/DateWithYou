/*
 * Two small things the plan screen says, and the limits on what they claim.
 *
 * Neither is precise, and both are shown to somebody deciding whether to get
 * the bike out — so the interesting tests are about not over-claiming. A time
 * that looks exact is worse than one that says "khoảng"; a forecast that
 * silently rearranges a day is worse than one that just mentions the rain.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { rideMinutes, rideLabel, CITY_SPEED_KMH, OVERHEAD_MIN } from "../../src/lib/ride-minutes.ts";
import {
  mapForecast,
  atHour,
  rainHeadline,
  rainWarningFor,
  RAIN_LIKELY_PCT,
} from "../../src/lib/weather.ts";

describe("how long that hop takes, roughly", () => {
  test("a longer hop takes longer", () => {
    const near = rideMinutes(500)!;
    const far = rideMinutes(5000)!;
    assert.ok(far > near, `${far} should exceed ${near}`);
  });

  test("the city speed is the pessimistic one, not the top speed", () => {
    // 18 km/h door to door across Saigon. A number closer to a top speed would
    // promise an afternoon that does not fit.
    assert.ok(CITY_SPEED_KMH <= 25, "a flattering speed makes every plan run late");
    const fiveKm = rideMinutes(5000)!;
    assert.ok(fiveKm >= 15, `5km in ${fiveKm} minutes is not this city`);
  });

  test("even a zero-metre hop costs the getting-there overhead", () => {
    // Parking, finding the door, waiting to pull out. A hop that claims zero
    // minutes is a plan that runs late by the end of the afternoon.
    assert.equal(rideMinutes(0), OVERHEAD_MIN);
    assert.ok(rideMinutes(10)! >= OVERHEAD_MIN);
  });

  test("something you could walk says so instead of a time", () => {
    assert.equal(rideLabel(120), "đi bộ được");
    assert.match(rideLabel(2000) ?? "", /khoảng \d+ phút/);
  });

  test("a missing or nonsense distance says nothing at all", () => {
    for (const v of [null, undefined, NaN, -5, Infinity]) {
      assert.equal(rideMinutes(v as number), null);
      assert.equal(rideLabel(v as number), null);
    }
  });

  test("the phrase always hedges", () => {
    // "12 phút" reads as a promise; "khoảng 12 phút" reads as what it is.
    assert.ok((rideLabel(3000) ?? "").startsWith("khoảng"));
  });
});

const FORECAST = {
  hourly: {
    time: ["2026-09-15T14:00", "2026-09-15T15:00", "2026-09-15T16:00", "2026-09-16T14:00"],
    precipitation_probability: [10, 55, 95, 0],
    temperature_2m: [31.4, 28.1, 26.6, 30.0],
  },
};

describe("reading the forecast", () => {
  test("only the day being planned comes through", () => {
    const hours = mapForecast(FORECAST, "2026-09-15");
    assert.deepEqual(hours.map((h) => h.time), ["14:00", "15:00", "16:00"]);
    assert.equal(hours[2].rainChance, 95);
    assert.equal(hours[0].tempC, 31);
  });

  test("a body that is not a forecast is an empty afternoon, not a crash", () => {
    for (const body of [null, undefined, {}, { hourly: null }, { hourly: {} }, "nope", 7]) {
      assert.deepEqual(mapForecast(body, "2026-09-15"), []);
    }
  });

  test("the hour a stop starts in is the hour it is asked about", () => {
    const hours = mapForecast(FORECAST, "2026-09-15");
    assert.equal(atHour(hours, "16:30")?.rainChance, 95, "16:30 belongs to the 16:00 hour");
    assert.equal(atHour(hours, "22:00"), null, "an hour with no forecast is null, not zero");
  });
});

describe("what gets said about rain", () => {
  const hours = mapForecast(FORECAST, "2026-09-15");

  test("a dry afternoon is not mentioned", () => {
    // Silence is the common answer. A weather line on every plan is noise, and
    // noise is what people stop reading.
    assert.equal(rainHeadline(hours, ["14:00"]), null);
  });

  test("a wet hour is mentioned, with the hour and the number", () => {
    const line = rainHeadline(hours, ["14:00", "16:00"]) ?? "";
    assert.match(line, /16h/);
    assert.match(line, /95%/);
    assert.match(line, /áo mưa/, "and what to do about it");
  });

  test("the worst hour of the afternoon is the one reported", () => {
    const line = rainHeadline(hours, ["14:00", "15:00", "16:00"]) ?? "";
    assert.match(line, /95%/, "not the first wet hour, the worst one");
  });

  test("hours with no forecast say nothing", () => {
    assert.equal(rainHeadline(hours, ["23:00"]), null);
    assert.equal(rainHeadline([], ["16:00"]), null);
  });
});

describe("which stops get warned", () => {
  const hours = mapForecast(FORECAST, "2026-09-15");

  test("a walk in the rain gets a warning", () => {
    const w = rainWarningFor(hours, { kind: "stroll", startTime: "16:00" });
    assert.match(w ?? "", /ngoài trời/);
    assert.match(w ?? "", /95%/);
  });

  test("dinner in the rain does not — you were going indoors anyway", () => {
    assert.equal(rainWarningFor(hours, { kind: "meal", startTime: "16:00" }), null);
    assert.equal(rainWarningFor(hours, { kind: "cafe", startTime: "16:00" }), null);
  });

  test("a walk in the dry does not either", () => {
    assert.equal(rainWarningFor(hours, { kind: "stroll", startTime: "14:00" }), null);
  });

  test("the threshold is a real threshold", () => {
    const edge = mapForecast(
      {
        hourly: {
          time: ["2026-09-15T14:00", "2026-09-15T15:00"],
          precipitation_probability: [RAIN_LIKELY_PCT - 1, RAIN_LIKELY_PCT],
          temperature_2m: [30, 30],
        },
      },
      "2026-09-15",
    );
    assert.equal(rainWarningFor(edge, { kind: "stroll", startTime: "14:00" }), null);
    assert.ok(rainWarningFor(edge, { kind: "stroll", startTime: "15:00" }));
  });
});
