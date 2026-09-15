/*
 * "Hôm nay đi đâu?" — the two procedures behind the button.
 *
 * `generate` is a rehearsal and must leave no trace: someone can press it ten
 * times, hate all ten answers, close the tab, and the space is exactly as they
 * left it. `confirm` is the moment of consent, and the only moment anything is
 * written — one trip, one plan item per stop, and a row for any place Google
 * found that they decided to keep.
 *
 * That split is the whole point of this file. It is easy to write a generator
 * that saves as it goes, and impossible to explain to someone why their map
 * filled up with places they never chose.
 */
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { freshDatabase, closeDatabase, makeMember, makeCouple, rejects, must } from "./_harness.ts";

/** A Tuesday at 16:00 — the plain afternoon-into-evening shape. */
const DATE = "2026-09-15";
const START = "16:00";

before(freshDatabase);
after(closeDatabase);

type Member = Awaited<ReturnType<typeof makeMember>>;

/*
 * Places, written straight into Mongo.
 *
 * Deliberately not through `location.create`: given coordinates it asks a
 * geocoder what ward they are in, over the network. That would make this file
 * slow, flaky and dependent on someone else's uptime — and it would overwrite
 * the district these tests filter on.
 */
async function seedPlace(spaceId: string, over: Record<string, unknown>) {
  const doc = {
    spaceId,
    district: "Phường Sài Gòn",
    geo: { lat: 10.776, lng: 106.70 },
    status: "want_to_go",
    source: "user",
    createdBy: "seed",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  const r = await mongoose.connection.collection("locations").insertOne(doc);
  return String(r.insertedId);
}

/** Places enough to fill a whole afternoon. */
async function stockUp(me: Member) {
  const rows = [
    { name: "Cà phê Vợt", category: "Cà phê" },
    { name: "Cà phê Sân Vườn", category: "Cà phê" },
    { name: "Quán Nướng", category: "Ăn tối" },
    { name: "Cơm Tấm Đêm", category: "Ăn tối" },
    { name: "Công viên Bến Bạch Đằng", category: "Công viên" },
  ];
  for (const [i, r] of rows.entries()) {
    await seedPlace(me.spaceId, {
      name: r.name,
      category: r.category,
      geo: { lat: 10.776 + i / 10_000, lng: 106.70 + i / 10_000 },
    });
  }
}

/** How many documents live in every collection right now. */
async function census(): Promise<Record<string, number>> {
  const cols = await mongoose.connection.db!.listCollections().toArray();
  const out: Record<string, number> = {};
  for (const c of cols) {
    out[c.name] = await mongoose.connection.collection(c.name).countDocuments();
  }
  return out;
}

describe("generate leaves nothing behind", () => {
  test("ten rehearsals change not one document, in any collection", async () => {
    /*
     * Swept the same way the space-deletion test sweeps: every collection, not
     * a list of the ones we remembered. A generator that quietly saved its
     * suggestions would show up here as a growing `locations` count, which is
     * exactly the failure this feature could have had.
     *
     * (With a Google key configured the one write would be the daily allowance
     * counter on the space's config row — a counter, not a row. This machine
     * has no key, so even that does not move; see places-quota.test.ts.)
     */
    const me = await makeMember({ name: "Rehearsal" });
    await stockUp(me);
    await me.caller.dayPlan.generate({ date: DATE, startAt: START });

    const before = await census();
    for (let i = 0; i < 10; i++) {
      await me.caller.dayPlan.generate({ date: DATE, startAt: START, seed: `try-${i}` });
    }
    assert.deepEqual(await census(), before, "a rehearsal must not write anything");
  });

  test("it hands back a real afternoon, with a reason for each stop", async () => {
    const me = await makeMember({ name: "Shape" });
    await stockUp(me);
    const draft = await me.caller.dayPlan.generate({ date: DATE, startAt: START });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.stops.length, 3);
    assert.deepEqual(draft.stops.map((s) => s.kind), ["cafe", "meal", "stroll"]);
    for (const s of draft.stops) {
      assert.ok(s.title, "every stop needs something to show");
      assert.ok(s.reason, "and a sentence saying why it is there");
    }
    assert.ok(draft.band.max > draft.band.min, "money is a range");
  });

  test("outside the hours it plans for, it says so instead of inventing a day", async () => {
    const me = await makeMember({ name: "Nocturnal" });
    await stockUp(me);
    const out = await me.caller.dayPlan.generate({ date: DATE, startAt: "03:00" });
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.equal(out.reason, "outOfHours");
    assert.match(out.nextStartAt, /^\d{2}:\d{2}$/);
  });

  test("an empty space gets empty slots, not an error", async () => {
    // This is the arrival path from the two SEO pages. A 500 here loses the
    // person who came looking for exactly this feature.
    const me = await makeMember({ name: "Empty" });
    const draft = await me.caller.dayPlan.generate({ date: DATE, startAt: START });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.ok(draft.stops.every((s) => s.unfilled));
    assert.ok(draft.needsMorePlaces, "and it says what would fix it");
  });

  test("the same seed twice gives the same afternoon", async () => {
    const me = await makeMember({ name: "Repeat" });
    await stockUp(me);
    const a = await me.caller.dayPlan.generate({ date: DATE, startAt: START, seed: "same" });
    const b = await me.caller.dayPlan.generate({ date: DATE, startAt: START, seed: "same" });
    assert.deepEqual(a, b);
  });

  test("it only ever offers this space's places", async () => {
    const mine = await makeMember({ name: "Mine" });
    const theirs = await makeMember({ name: "Theirs" });
    await stockUp(theirs);
    const draft = await mine.caller.dayPlan.generate({ date: DATE, startAt: START });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.ok(draft.stops.every((s) => s.unfilled), "another space's places are not ours to offer");
  });

  test("a signed-out caller gets nothing", async () => {
    const { callerFor } = await import("./_harness.ts");
    await rejects(
      () => callerFor().dayPlan.generate({ date: DATE, startAt: START }),
      "UNAUTHORIZED",
    );
  });
});

describe("confirm is the only thing that writes", () => {
  async function draftFor(me: Member) {
    const d = await me.caller.dayPlan.generate({ date: DATE, startAt: START, seed: "fixed" });
    assert.equal(d.ok, true);
    if (!d.ok) throw new Error("expected a plan");
    return d;
  }

  test("it makes one trip and one item per stop, tied together", async () => {
    const me = await makeMember({ name: "Confirm" });
    await stockUp(me);
    const draft = await draftFor(me);
    const kept = draft.stops.filter((s) => !s.unfilled);

    const out = await me.caller.dayPlan.confirm({
      date: DATE,
      title: "Chiều lười",
      stops: kept.map((s) => ({
        kind: s.kind, startTime: s.startTime, title: s.title, locationId: s.locationId!,
      })),
    });

    const trip = must(await mongoose.connection.collection("trips").findOne({ _id: new mongoose.Types.ObjectId(out.tripId) }));
    assert.equal(trip.startDate, DATE);
    assert.equal(trip.endDate, DATE, "a day plan is one day, start and end");
    assert.equal(trip.spaceId, me.spaceId);

    const items = await mongoose.connection.collection("planitems")
      .find({ tripId: out.tripId }).sort({ order: 1 }).toArray();
    assert.equal(items.length, kept.length);
    assert.deepEqual(items.map((i) => i.time), kept.map((s) => s.startTime));
    assert.deepEqual(items.map((i) => i.locationId), kept.map((s) => s.locationId));
    assert.ok(items.every((i) => i.spaceId === me.spaceId));
    assert.ok(items.every((i) => i.date === DATE));
  });

  test("a stop dropped before confirming is not written", async () => {
    const me = await makeMember({ name: "Dropper" });
    await stockUp(me);
    const draft = await draftFor(me);
    const kept = draft.stops.filter((s) => !s.unfilled);
    const dropped = kept[1];

    const out = await me.caller.dayPlan.confirm({
      date: DATE,
      stops: kept.filter((s) => s !== dropped).map((s) => ({
        kind: s.kind, startTime: s.startTime, title: s.title, locationId: s.locationId!,
      })),
    });
    const items = await mongoose.connection.collection("planitems").find({ tripId: out.tripId }).toArray();
    assert.equal(items.length, kept.length - 1);
    assert.ok(!items.some((i) => i.locationId === dropped.locationId), "the dropped stop must be absent");
  });

  test("confirming the same plan twice gives one trip, not two", async () => {
    // A flaky connection and a second tap are the same thing to the server.
    const me = await makeMember({ name: "Twice" });
    await stockUp(me);
    const draft = await draftFor(me);
    const body = {
      date: DATE,
      stops: draft.stops.filter((s) => !s.unfilled).map((s) => ({
        kind: s.kind, startTime: s.startTime, title: s.title, locationId: s.locationId!,
      })),
    };
    const first = await me.caller.dayPlan.confirm(body);
    const second = await me.caller.dayPlan.confirm(body);
    assert.equal(second.tripId, first.tripId, "the second confirm must land on the first trip");
    assert.equal(second.alreadyConfirmed, true);
    assert.equal(
      await mongoose.connection.collection("trips").countDocuments({ spaceId: me.spaceId }), 1,
    );
    assert.equal(
      await mongoose.connection.collection("planitems").countDocuments({ spaceId: me.spaceId }),
      body.stops.length,
    );
  });

  test("a different plan on the same day is a different trip", async () => {
    const me = await makeMember({ name: "Different" });
    await stockUp(me);
    const draft = await draftFor(me);
    const kept = draft.stops.filter((s) => !s.unfilled);
    const all = { date: DATE, stops: kept.map((s) => ({ kind: s.kind, startTime: s.startTime, title: s.title, locationId: s.locationId! })) };
    const fewer = { date: DATE, stops: all.stops.slice(0, 2) };
    const a = await me.caller.dayPlan.confirm(all);
    const b = await me.caller.dayPlan.confirm(fewer);
    assert.notEqual(b.tripId, a.tripId);
  });

  test("a place belonging to another space cannot be confirmed into mine", async () => {
    const mine = await makeMember({ name: "Host" });
    const theirs = await makeMember({ name: "Stranger" });
    await stockUp(theirs);
    const stolen = must(await mongoose.connection.collection("locations").findOne({ spaceId: theirs.spaceId }));
    await rejects(
      () => mine.caller.dayPlan.confirm({
        date: DATE,
        stops: [{ kind: "cafe", startTime: "16:00", title: "Trộm", locationId: String(stolen._id) }],
      }),
      "BAD_REQUEST",
    );
    assert.equal(await mongoose.connection.collection("trips").countDocuments({ spaceId: mine.spaceId }), 0);
  });

  test("both people in a space see the trip the other confirmed", async () => {
    const { a, b } = await makeCouple({ a: "Pair1", b: "Pair2" });
    await stockUp(a);
    const draft = await a.caller.dayPlan.generate({ date: DATE, startAt: START });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    const out = await a.caller.dayPlan.confirm({
      date: DATE,
      stops: draft.stops.filter((s) => !s.unfilled).map((s) => ({
        kind: s.kind, startTime: s.startTime, title: s.title, locationId: s.locationId!,
      })),
    });
    const seen = await b.caller.trip.list();
    assert.ok(seen.some((t: { id: string }) => t.id === out.tripId));
  });

  test("an empty plan is refused", async () => {
    const me = await makeMember({ name: "Nothing" });
    await rejects(
      () => me.caller.dayPlan.confirm({ date: DATE, stops: [] }),
      "BAD_REQUEST",
    );
  });
});

describe("places Google found", () => {
  test("a suggestion becomes a real row only when the plan is confirmed", async () => {
    /*
     * The suggestion arrives in the confirm body because it never existed in
     * the database — that is the design. What matters is that it lands marked,
     * so the wheel, the map, the list and the stats can all tell it apart from
     * somewhere the couple chose.
     */
    const me = await makeMember({ name: "Suggested" });
    const out = await me.caller.dayPlan.confirm({
      date: DATE,
      stops: [{
        kind: "cafe", startTime: "16:00", title: "Cà phê Lạ",
        suggestion: {
          externalId: "ChIJ-day-plan-test-0001",
          name: "Cà phê Lạ",
          category: "Cà phê",
          district: "Phường Sài Gòn",
          geo: { lat: 10.7801, lng: 106.6991 },
          rating: 4.3,
          priceLevel: 1,
        },
      }],
    });
    const row = must(await mongoose.connection.collection("locations")
      .findOne({ spaceId: me.spaceId, externalId: "ChIJ-day-plan-test-0001" }));
    assert.equal(row.source, "suggested", "it must be marked, or four screens go wrong");
    assert.equal(row.name, "Cà phê Lạ");
    assert.equal(row.priceLevel, 1);
    const item = must(await mongoose.connection.collection("planitems").findOne({ tripId: out.tripId }));
    assert.equal(item.locationId, String(row._id), "the item points at the row that was created");
  });

  test("the same Google place twice makes one row", async () => {
    const me = await makeMember({ name: "Dedupe" });
    const body = (day: string) => ({
      date: day,
      stops: [{
        kind: "cafe" as const, startTime: "16:00", title: "Cùng một quán",
        suggestion: {
          externalId: "ChIJ-day-plan-test-0002",
          name: "Cùng một quán",
          category: "Cà phê",
          district: "Phường Sài Gòn",
          geo: { lat: 10.781, lng: 106.698 },
        },
      }],
    });
    await me.caller.dayPlan.confirm(body("2026-09-15"));
    await me.caller.dayPlan.confirm(body("2026-09-16"));
    assert.equal(
      await mongoose.connection.collection("locations")
        .countDocuments({ spaceId: me.spaceId, externalId: "ChIJ-day-plan-test-0002" }),
      1,
    );
  });

  test("two spaces may each keep the same Google place", async () => {
    // The unique key is (space, place) — one couple saving a café says nothing
    // about another couple's map.
    const one = await makeMember({ name: "SpaceOne" });
    const two = await makeMember({ name: "SpaceTwo" });
    const stop = {
      kind: "cafe" as const, startTime: "16:00", title: "Chung",
      suggestion: {
        externalId: "ChIJ-day-plan-test-0003",
        name: "Chung", category: "Cà phê", district: "Phường Sài Gòn",
        geo: { lat: 10.782, lng: 106.697 },
      },
    };
    await one.caller.dayPlan.confirm({ date: DATE, stops: [stop] });
    await two.caller.dayPlan.confirm({ date: DATE, stops: [stop] });
    assert.equal(
      await mongoose.connection.collection("locations")
        .countDocuments({ externalId: "ChIJ-day-plan-test-0003" }),
      2,
    );
  });

  test("hand-added places without a Google id do not collide", async () => {
    /*
     * The index that de-duplicates Google places must not de-duplicate the
     * ordinary rows that have no id at all. A sparse compound index does
     * exactly that wrong thing — every row is indexed under a null — which is
     * why the index is partial. This is the ratchet on that.
     */
    const me = await makeMember({ name: "NoIds" });
    await stockUp(me);
    assert.ok(
      await mongoose.connection.collection("locations").countDocuments({ spaceId: me.spaceId }) >= 5,
    );
  });
});

describe("the words, when there is no model to write them", () => {
  test("every stop still explains itself, and the day has no invented name", async () => {
    /*
     * No LLM provider is configured — deliberately, until somebody measures a
     * real free tier. The plan has to be complete anyway: sentences come from
     * templates built out of facts already on the record, and `dayName` stays
     * null rather than being made up.
     */
    assert.equal(process.env.DAY_PLAN_LLM_URL, undefined, "this test assumes no provider");
    const me = await makeMember({ name: "NoModel" });
    await stockUp(me);
    const draft = await me.caller.dayPlan.generate({ date: DATE, startAt: START });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.dayName, null);
    for (const s of draft.stops.filter((x) => !x.unfilled)) {
      assert.ok(s.reason.trim().length > 0, "a stop with no sentence is just a list entry");
    }
  });
});

describe("somewhere you have just been", () => {
  test("a place visited yesterday is passed over for one you have not", async () => {
    /*
     * The recency penalty is fed from the last month of confirmed plans, which
     * is the loop that makes this feature stop repeating itself. Tested at the
     * router because the wiring — reading plan items back out and turning them
     * into last-visit dates — is the part that can silently be forgotten.
     */
    const me = await makeMember({ name: "Recent" });
    const beenId = await seedPlace(me.spaceId, { name: "Quán Đã Đi", category: "Ăn tối" });
    await seedPlace(me.spaceId, { name: "Quán Chưa Đi", category: "Ăn tối" });

    const yesterday = new Date(Date.parse(`${DATE}T00:00:00Z`) - 86_400_000)
      .toISOString().slice(0, 10);
    await me.caller.planItem.create({
      title: "Ăn ở Quán Đã Đi", date: yesterday, bucket: "evening",
      locationId: beenId,
    });

    const draft = await me.caller.dayPlan.generate({ date: DATE, startAt: START });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    const dinner = draft.stops.find((s) => s.kind === "meal");
    assert.equal(dinner?.unfilled, false, "there are two dinners to choose from");
    assert.notEqual(dinner?.locationId, beenId, "yesterday's dinner must not be tonight's");
    assert.equal(dinner?.title, "Quán Chưa Đi");
  });
});
