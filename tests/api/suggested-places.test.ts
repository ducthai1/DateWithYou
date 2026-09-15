/*
 * A new kind of row in a table four working screens already read.
 *
 * Confirming a day plan can save a place nobody chose — Google found it, the
 * couple accepted a plan containing it. That row is theirs and belongs in
 * their space, but it is not yet somewhere they picked, and the difference has
 * to survive into every screen that reads `locations`:
 *
 *   the wheel     must never land on one, or "chỗ của tụi mình" stops meaning
 *                 anything the first time it spins out a stranger
 *   the list      shows them, marked, with a way to keep or drop
 *   the map       pins them in another colour
 *   the stats     count them apart: "12 chỗ · 4 gợi ý"
 *
 * This file is the gate on all four. It is written before the screens change,
 * because the failure it guards against is silent: nothing errors, the wheel
 * just quietly starts suggesting places two people never talked about.
 */
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { freshDatabase, closeDatabase, makeMember, rejects, must } from "./_harness.ts";
import { sweepStaleSuggestions, SUGGESTION_TTL_DAYS } from "../../src/server/lib/sweep-stale-suggestions.ts";

before(freshDatabase);
after(closeDatabase);

const dayMs = 86_400_000;

async function seed(spaceId: string, over: Record<string, unknown> = {}) {
  const r = await mongoose.connection.collection("locations").insertOne({
    spaceId,
    name: "Quán",
    district: "Phường Sài Gòn",
    category: "Cà phê",
    geo: { lat: 10.776, lng: 106.70 },
    status: "want_to_go",
    source: "user",
    createdBy: "seed",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });
  return String(r.insertedId);
}

describe("location.list can tell them apart", () => {
  test("asking for the couple's own places leaves the suggestions out", async () => {
    const me = await makeMember({ name: "Filter" });
    const mine = await seed(me.spaceId, { name: "Chỗ mình chọn" });
    await seed(me.spaceId, { name: "Chỗ máy gợi ý", source: "suggested", externalId: "ChIJ-f1" });

    const own = await me.caller.location.list({ source: "user" });
    assert.deepEqual(own.map((p) => p.id), [mine]);
  });

  test("and can ask for only the suggestions", async () => {
    const me = await makeMember({ name: "Only" });
    await seed(me.spaceId, { name: "Của mình" });
    const sug = await seed(me.spaceId, { name: "Gợi ý", source: "suggested", externalId: "ChIJ-f2" });
    const out = await me.caller.location.list({ source: "suggested" });
    assert.deepEqual(out.map((p) => p.id), [sug]);
  });

  test("asking for neither returns both, each saying which it is", async () => {
    // The list screen wants them all; it needs the flag to badge them.
    const me = await makeMember({ name: "Both" });
    await seed(me.spaceId, { name: "Của mình" });
    await seed(me.spaceId, { name: "Gợi ý", source: "suggested", externalId: "ChIJ-f3" });
    const all = await me.caller.location.list();
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((p) => p.source).sort(), ["suggested", "user"]);
  });

  test("a row saved before this field existed reads as the couple's own", async () => {
    /*
     * Every place in every space today has no `source` at all. If those read
     * as anything but "user" the wheel empties out for everyone on the day
     * this ships — which is the kind of migration bug that only shows in
     * production.
     */
    const me = await makeMember({ name: "Legacy" });
    await mongoose.connection.collection("locations").insertOne({
      spaceId: me.spaceId, name: "Quán cũ", district: "Phường Sài Gòn",
      category: "Cà phê", status: "want_to_go", createdBy: "old",
      createdAt: new Date(), updatedAt: new Date(),
    });
    const own = await me.caller.location.list({ source: "user" });
    assert.equal(own.length, 1, "a row with no source must count as the couple's own");
    assert.equal(own[0].source, "user");
  });
});

describe("keeping or dropping a suggestion", () => {
  test("keeping it makes it an ordinary place", async () => {
    const me = await makeMember({ name: "Keeper" });
    const id = await seed(me.spaceId, { source: "suggested", externalId: "ChIJ-k1" });
    await me.caller.location.keepSuggested({ id });
    const row = must(await mongoose.connection.collection("locations")
      .findOne({ _id: new mongoose.Types.ObjectId(id) }));
    assert.equal(row.source, "user");
    assert.equal(row.externalId, "ChIJ-k1", "and it keeps the Google id, so it is never re-saved twice");
    const wheel = await me.caller.location.list({ source: "user" });
    assert.equal(wheel.length, 1, "from now on the wheel may land on it");
  });

  test("another space cannot keep my suggestion", async () => {
    const mine = await makeMember({ name: "Owner" });
    const theirs = await makeMember({ name: "Outsider" });
    const id = await seed(mine.spaceId, { source: "suggested", externalId: "ChIJ-k2" });
    await rejects(() => theirs.caller.location.keepSuggested({ id }), "NOT_FOUND");
    const row = must(await mongoose.connection.collection("locations")
      .findOne({ _id: new mongoose.Types.ObjectId(id) }));
    assert.equal(row.source, "suggested", "untouched");
  });

  test("dropping one is the delete that already exists", async () => {
    const me = await makeMember({ name: "Dropper" });
    const id = await seed(me.spaceId, { source: "suggested", externalId: "ChIJ-k3" });
    await me.caller.location.remove({ id });
    assert.equal(
      await mongoose.connection.collection("locations")
        .countDocuments({ _id: new mongoose.Types.ObjectId(id) }),
      0,
    );
  });
});

describe("the numbers on the stats screen", () => {
  test("a suggestion is not counted as a place the couple pinned", async () => {
    const me = await makeMember({ name: "Counter" });
    await seed(me.spaceId, { name: "A" });
    await seed(me.spaceId, { name: "B" });
    await seed(me.spaceId, { name: "C", source: "suggested", externalId: "ChIJ-s1" });

    const stats = await me.caller.stats.overview();
    assert.equal(stats.placesPinned, 2, "two chosen places, not three");
    assert.equal(stats.placesSuggested, 1, "the third is counted, separately");
  });

  test("keeping one moves it across", async () => {
    const me = await makeMember({ name: "Mover" });
    const id = await seed(me.spaceId, { source: "suggested", externalId: "ChIJ-s2" });
    const before = await me.caller.stats.overview();
    assert.equal(before.placesPinned, 0);
    await me.caller.location.keepSuggested({ id });
    const after = await me.caller.stats.overview();
    assert.equal(after.placesPinned, 1);
    assert.equal(after.placesSuggested, 0);
  });
});

describe("suggestions nobody wanted", () => {
  const old = (days: number) => new Date(Date.now() - days * dayMs);

  test(`one ignored for ${SUGGESTION_TTL_DAYS} days is swept away`, async () => {
    const me = await makeMember({ name: "Stale" });
    const id = await seed(me.spaceId, {
      source: "suggested", externalId: "ChIJ-t1", createdAt: old(SUGGESTION_TTL_DAYS + 1),
    });
    const swept = await sweepStaleSuggestions();
    assert.ok(swept >= 1);
    assert.equal(await mongoose.connection.collection("locations")
      .countDocuments({ _id: new mongoose.Types.ObjectId(id) }), 0);
  });

  test("one still inside the window is left alone", async () => {
    const me = await makeMember({ name: "Fresh" });
    const id = await seed(me.spaceId, {
      source: "suggested", externalId: "ChIJ-t2", createdAt: old(SUGGESTION_TTL_DAYS - 1),
    });
    await sweepStaleSuggestions();
    assert.equal(await mongoose.connection.collection("locations")
      .countDocuments({ _id: new mongoose.Types.ObjectId(id) }), 1);
  });

  test("a place the couple kept is never swept, however old", async () => {
    const me = await makeMember({ name: "Kept" });
    const id = await seed(me.spaceId, { externalId: "ChIJ-t3", createdAt: old(900) });
    await sweepStaleSuggestions();
    assert.equal(await mongoose.connection.collection("locations")
      .countDocuments({ _id: new mongoose.Types.ObjectId(id) }), 1);
  });

  test("one they actually went to is never swept either", async () => {
    // Going somewhere is a stronger "keep" than pressing the button.
    const me = await makeMember({ name: "Visited" });
    const id = await seed(me.spaceId, {
      source: "suggested", externalId: "ChIJ-t4",
      status: "visited", visitedAt: old(70), createdAt: old(900),
    });
    await sweepStaleSuggestions();
    assert.equal(await mongoose.connection.collection("locations")
      .countDocuments({ _id: new mongoose.Types.ObjectId(id) }), 1);
  });

  test("one that is part of a confirmed plan is never swept", async () => {
    /*
     * A stop on a trip somebody agreed to. Deleting it would leave a plan item
     * pointing at a place that no longer exists — a broken row on a day in
     * their calendar, which is worse than an unused suggestion.
     */
    const me = await makeMember({ name: "Planned" });
    const id = await seed(me.spaceId, {
      source: "suggested", externalId: "ChIJ-t5", createdAt: old(900),
    });
    await me.caller.planItem.create({
      title: "Ghé đây", date: "2026-09-15", bucket: "evening", locationId: id,
    });
    await sweepStaleSuggestions();
    assert.equal(await mongoose.connection.collection("locations")
      .countDocuments({ _id: new mongoose.Types.ObjectId(id) }), 1);
  });
});
