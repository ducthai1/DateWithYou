/*
 * The only part of this app that spends money per call.
 *
 * Asking Google for places the couple has not saved is what makes the day
 * planner work for a brand-new space — and it is billed per request, so the
 * allowance is not a nicety, it is the thing that stops a loop or a bored
 * tester from running up a bill. These tests drive the allowance directly:
 * no key, no network, no quota, just the arithmetic that has to be right.
 */
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { freshDatabase, closeDatabase, makeMember } from "./_harness.ts";
import {
  claimPlacesSearch,
  searchPlacesNearby,
  PLACES_DAILY_CAP,
  __clearPlacesCache,
} from "../../src/server/lib/search-places-nearby.ts";

const TODAY = "2026-09-15";
const TOMORROW = "2026-09-16";

before(async () => {
  await freshDatabase();
  __clearPlacesCache();
});
after(closeDatabase);

const configOf = (spaceId: string) =>
  mongoose.connection.collection("locationconfigs").findOne({ spaceId });

describe("today's allowance", () => {
  test(`the first ${PLACES_DAILY_CAP} are granted and the next is not`, async () => {
    const me = await makeMember({ name: "Quota" });
    for (let i = 1; i <= PLACES_DAILY_CAP; i++) {
      const claim = await claimPlacesSearch(me.spaceId, TODAY);
      assert.equal(claim.ok, true, `call ${i} should be allowed`);
      assert.equal(claim.used, i, "the count is what was actually spent");
    }
    const over = await claimPlacesSearch(me.spaceId, TODAY);
    assert.equal(over.ok, false, "the call past the allowance must be refused");
  });

  test("being over the allowance is a refusal, never an exception", async () => {
    // The plan still has to come out of saved places. Throwing here would turn
    // a spent allowance into a 500 on somebody's evening.
    const me = await makeMember({ name: "Calm" });
    for (let i = 0; i < PLACES_DAILY_CAP + 4; i++) {
      await assert.doesNotReject(() => claimPlacesSearch(me.spaceId, TODAY));
    }
  });

  test("a new day starts fresh, with no scheduled job to do it", async () => {
    const me = await makeMember({ name: "Rollover" });
    for (let i = 0; i < PLACES_DAILY_CAP; i++) await claimPlacesSearch(me.spaceId, TODAY);
    assert.equal((await claimPlacesSearch(me.spaceId, TODAY)).ok, false);

    const tomorrow = await claimPlacesSearch(me.spaceId, TOMORROW);
    assert.equal(tomorrow.ok, true, "yesterday's count must not follow the space into today");
    assert.equal(tomorrow.used, 1);
  });

  test("one space cannot spend another space's allowance", async () => {
    const mine = await makeMember({ name: "Mine" });
    const theirs = await makeMember({ name: "Theirs" });
    for (let i = 0; i < PLACES_DAILY_CAP; i++) await claimPlacesSearch(mine.spaceId, TODAY);
    assert.equal((await claimPlacesSearch(mine.spaceId, TODAY)).ok, false);
    assert.equal((await claimPlacesSearch(theirs.spaceId, TODAY)).ok, true);
  });

  test("the counter rides on the space's own config row", async () => {
    /*
     * Deliberately not a collection of its own: this row is already one per
     * space and is already swept when a space is deleted, so the allowance
     * goes with it and `delete-space-cascade` needs no new entry. Pinning that
     * here means a future move to a separate collection has to face the
     * cascade question on purpose rather than by accident.
     */
    const me = await makeMember({ name: "Rider" });
    await claimPlacesSearch(me.spaceId, TODAY);
    const cfg = await configOf(me.spaceId);
    assert.equal(cfg?.placesSearchDate, TODAY);
    assert.equal(cfg?.placesSearchCount, 1);
  });

  test("a space that never opened its settings still gets an allowance", async () => {
    // `location.getConfig` creates that row on first read; the planner cannot
    // assume anyone has been to the settings screen.
    const me = await makeMember({ name: "Untouched" });
    await mongoose.connection.collection("locationconfigs").deleteMany({ spaceId: me.spaceId });
    const claim = await claimPlacesSearch(me.spaceId, TODAY);
    assert.equal(claim.ok, true);
    const cfg = await configOf(me.spaceId);
    assert.ok((cfg?.categories?.length ?? 0) > 0, "and it is seeded with the real default lists");
    assert.ok((cfg?.districts?.length ?? 0) > 0);
  });
});

describe("with no API key configured", () => {
  test("it reports why, and does not spend the allowance doing it", async () => {
    /*
     * This machine has no GOOGLE_MAPS_API_KEY, which is the case this test
     * wants: the feature must degrade to "plan from what you saved" rather
     * than erroring — and a key that is missing must not silently burn the
     * three calls a real key would have had.
     */
    assert.equal(process.env.GOOGLE_MAPS_API_KEY, undefined, "this test assumes no key is set");
    const me = await makeMember({ name: "Keyless" });
    const out = await searchPlacesNearby({
      spaceId: me.spaceId,
      query: "quán cà phê",
      near: { lat: 10.776, lng: 106.7 },
      weekday: 2,
      dateKey: TODAY,
    });
    assert.deepEqual(out.places, []);
    assert.equal(out.reason, "no-key");
    assert.equal(out.spent, false);
    assert.equal(await configOf(me.spaceId).then((c) => c?.placesSearchCount ?? 0), 0);
  });
});
