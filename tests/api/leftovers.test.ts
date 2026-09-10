/*
 * The procedures the earlier files did not reach, minus the ones that would
 * call a geocoder.
 *
 * Everything left in `location` after this — suggestPlaces, placeCoords,
 * placeDetail, searchAreas, areaAt, geoFromUrl, getRoute, rankMeetingPoints —
 * talks to Stadia, Google or Mapbox over the network. Those stay out on
 * purpose: a test suite that spends the owner's API quota and fails when a
 * third party is slow is worse than no test, and their pure parts (the
 * maneuver wording, the polyline decode) are covered in tests/unit.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import {
  freshDatabase,
  closeDatabase,
  callerFor,
  makeCouple,
  makeMember,
  makeUser,
  must,
  rejects,
} from "./_harness.ts";
import { TEST_ADMIN_EMAIL } from "./_env.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;
let admin: ReturnType<typeof callerFor>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
  const a = await makeUser({ name: "Quan tri", email: TEST_ADMIN_EMAIL });
  admin = callerFor({ userId: a.id, userEmail: a.email });
});

after(closeDatabase);

describe("joining a space", () => {
  test("the list of my spaces is mine alone", async () => {
    const mine = await couple.a.caller.space.getAllMine();
    assert.ok(mine.some((s) => s.id === couple.spaceId));
    const theirs = await outsider.caller.space.getAllMine();
    assert.ok(!theirs.some((s) => s.id === couple.spaceId));
  });

  test("a full space issues no more invites", async () => {
    // Two people is the whole space. A third code would spend itself on
    // somebody who could never join.
    const err = await rejects(() => couple.a.caller.space.createInvite(), "CONFLICT");
    assert.equal(err.message, "SPACE_FULL");
  });

  test("a code is single-use, and a wrong one says so", async () => {
    const host = await makeMember({ name: "Duong", spaceName: "Góc chờ người" });
    const { code } = await host.caller.space.createInvite();

    const joiner = await makeUser({ name: "Ngan" });
    const joined = await callerFor({ userId: joiner.id, userEmail: joiner.email }).space.joinByCode({ code });
    assert.equal(joined.id, host.spaceId);

    // Spent: the same code cannot bring a third person in.
    const third = await makeUser({ name: "Tam" });
    const err = await rejects(
      () => callerFor({ userId: third.id, userEmail: third.email }).space.joinByCode({ code }),
      "BAD_REQUEST",
    );
    assert.equal(err.message, "INVALID_OR_EXPIRED_CODE");
  });

  test("an invented code is refused", async () => {
    const stranger = await makeUser({ name: "Nguoi la" });
    await rejects(
      () => callerFor({ userId: stranger.id, userEmail: stranger.email }).space.joinByCode({ code: "KHONGCO" }),
      "BAD_REQUEST",
    );
  });

  test("you cannot join a space you are already in", async () => {
    const host = await makeMember({ name: "Hoa", spaceName: "Góc của Hoa" });
    const { code } = await host.caller.space.createInvite();
    await rejects(() => host.caller.space.joinByCode({ code }), "BAD_REQUEST");
  });

  test("no Google account means no avatar, not an error", async () => {
    assert.deepEqual(await couple.a.caller.space.getGoogleAvatar(), { url: null });
  });
});

describe("the place list's own categories and districts", () => {
  test("first read seeds the space's own copy of the defaults", async () => {
    const config = await couple.a.caller.location.getConfig();
    assert.ok(config.categories.includes("Cà phê"));
    assert.ok(config.districts.length > 0);
  });

  test("a couple may replace both lists, and it stays theirs", async () => {
    await couple.a.caller.location.updateConfig({
      categories: ["Cà phê", "Ăn khuya"],
      districts: ["Phường Sài Gòn"],
    });
    assert.deepEqual((await couple.a.caller.location.getConfig()).categories, ["Cà phê", "Ăn khuya"]);

    const theirs = await outsider.caller.location.getConfig();
    assert.ok(theirs.categories.length > 2, "another space keeps the defaults");
  });
});

describe("memory tags", () => {
  test("the tag list is this space's, deduplicated and sorted", async () => {
    await couple.a.caller.memory.create({
      title: "Một",
      date: new Date("2026-01-01"),
      tags: ["đà lạt", "biển"],
    });
    await couple.b.caller.memory.create({
      title: "Hai",
      date: new Date("2026-01-02"),
      tags: ["biển", "ăn uống"],
    });
    await outsider.caller.memory.create({
      title: "Của người khác",
      date: new Date("2026-01-03"),
      tags: ["không-thuộc-đây"],
    });

    const tags = await couple.a.caller.memory.tags();
    assert.deepEqual(tags, ["ăn uống", "biển", "đà lạt"]);
    assert.ok(!tags.includes("không-thuộc-đây"));
  });
});

describe("redeeming a wish with points", () => {
  async function credit(points: number) {
    const { id } = await couple.a.caller.reward.createTask({ title: `Việc ${points}`, points });
    await couple.a.caller.reward.completeTask({ taskId: id, forUserId: couple.a.userId });
  }
  const balance = async () =>
    must(
      (await couple.a.caller.reward.overview()).balances.find((b) => b.userId === couple.a.userId),
      "balance",
    ).balance;

  test("not enough points: refused, and nothing is charged", async () => {
    const { id } = await couple.a.caller.wishlist.create({ itemName: "Tai nghe", pointCost: 50 });
    const before_ = await balance();
    await rejects(() => couple.a.caller.wishlist.redeem({ id }), "FORBIDDEN");
    assert.equal(await balance(), before_, "a refused redeem must not charge");
    assert.ok(
      !must((await couple.a.caller.wishlist.list()).find((w) => w.id === id), "wish").bought,
      "and must not claim the item",
    );
  });

  test("enough points: charged once, claimed once, logged once", async () => {
    await credit(80);
    const { id } = await couple.a.caller.wishlist.create({ itemName: "Sách", pointCost: 50 });
    const before_ = await balance();

    const res = await couple.a.caller.wishlist.redeem({ id });
    assert.equal(res.remainingBalance, before_ - 50);
    assert.equal(await balance(), before_ - 50);
    assert.ok(must((await couple.a.caller.wishlist.list()).find((w) => w.id === id), "wish").bought);

    const log = (await couple.a.caller.reward.overview()).recentLogs[0];
    assert.equal(log.points, -50, "the spend is logged as a negative entry");
  });

  test("a wish already bought cannot be redeemed again", async () => {
    const bought = must(
      (await couple.a.caller.wishlist.list()).find((w) => w.itemName === "Sách"),
      "wish",
    );
    const before_ = await balance();
    await rejects(() => couple.a.caller.wishlist.redeem({ id: bought.id }), "BAD_REQUEST");
    assert.equal(await balance(), before_);
  });

  test("a wish with no point price is not redeemable at all", async () => {
    const { id } = await couple.a.caller.wishlist.create({ itemName: "Không đổi được" });
    await rejects(() => couple.a.caller.wishlist.redeem({ id }), "BAD_REQUEST");
  });

  test("another couple's wish cannot be redeemed", async () => {
    const theirs = await outsider.caller.wishlist.create({ itemName: "Của người khác", pointCost: 1 });
    await rejects(() => couple.a.caller.wishlist.redeem({ id: theirs.id }), "NOT_FOUND");
  });
});

describe("a trip's checklist", () => {
  let tripId: string;

  test("items are added, ticked and removed", async () => {
    tripId = (
      await couple.a.caller.trip.create({
        title: "Đà Nẵng",
        startDate: "2026-08-01",
        endDate: "2026-08-04",
      })
    ).id;
    await couple.a.caller.trip.addChecklist({ tripId, content: "Mang dù" });
    await couple.b.caller.trip.addChecklist({ tripId, content: "Sạc dự phòng" });

    type Item = { id: string; content: string; isDone: boolean };
    let trip = await couple.a.caller.trip.get({ id: tripId });
    assert.equal(trip.checklists.length, 2);
    assert.ok(trip.checklists.every((c: Item) => !c.isDone));

    const first = trip.checklists[0];
    await couple.b.caller.trip.toggleChecklist({ tripId, checklistId: first.id, isDone: true });
    trip = await couple.a.caller.trip.get({ id: tripId });
    assert.equal(must(trip.checklists.find((c: Item) => c.id === first.id), "item").isDone, true);
    assert.equal(
      must(trip.checklists.find((c: Item) => c.id !== first.id), "other item").isDone,
      false,
      "ticking one must not tick the other",
    );

    await couple.a.caller.trip.removeChecklist({ tripId, checklistId: first.id });
    trip = await couple.a.caller.trip.get({ id: tripId });
    assert.equal(trip.checklists.length, 1);
    assert.ok(!trip.checklists.some((c: Item) => c.id === first.id));
  });

  test("an id that is not on this trip is refused", async () => {
    await rejects(
      () =>
        couple.a.caller.trip.toggleChecklist({
          tripId,
          checklistId: "6aa2000000000000000000aa",
          isDone: true,
        }),
      "NOT_FOUND",
    );
  });

  test("another couple cannot tick our list", async () => {
    const trip = await couple.a.caller.trip.get({ id: tripId });
    const item = trip.checklists[0];
    await rejects(
      () => outsider.caller.trip.toggleChecklist({ tripId, checklistId: item.id, isDone: true }),
      "NOT_FOUND",
    );
    assert.equal(
      must(
        (await couple.a.caller.trip.get({ id: tripId })).checklists.find(
          (c: { id: string; isDone: boolean }) => c.id === item.id,
        ),
        "item",
      ).isDone,
      false,
    );
  });

  test("the itinerary of one trip is only that trip's", async () => {
    await couple.a.caller.planItem.create({
      title: "Ăn mì Quảng",
      date: "2026-08-02",
      bucket: "noon",
      tripId,
    });
    await couple.a.caller.planItem.create({ title: "Việc ở nhà", date: "2026-08-02", bucket: "noon" });

    const ofTrip = await couple.a.caller.planItem.listByTrip({ tripId });
    assert.deepEqual(
      ofTrip.map((p) => p.title),
      ["Ăn mì Quảng"],
    );
  });
});

describe("blog categories and the shelves", () => {
  test("the first read seeds the default categories", async () => {
    const cats = await callerFor({}).blog.categories();
    assert.ok(cats.some((c) => c.slug === "tin-tuc"));
    assert.ok(cats.length >= 4);
  });

  test("a new category gets a slug of its own, and a clash gets a suffix", async () => {
    const first = await admin.blog.categoryCreate({ name: "Mẹo hay" });
    assert.equal(first.slug, "meo-hay-2", "the default already holds meo-hay");
    const renamed = await admin.blog.categoryUpdate({ slug: first.slug, name: "Mẹo hay hơn", order: 9 });
    assert.equal(renamed.name, "Mẹo hay hơn");
    assert.equal(renamed.order, 9);
    await admin.blog.categoryRemove({ slug: first.slug });
    assert.ok(!(await callerFor({}).blog.categories()).some((c) => c.slug === first.slug));
  });

  test("a category still holding posts refuses to disappear", async () => {
    const cat = await admin.blog.categoryCreate({ name: "Đang dùng" });
    await admin.blog.create({ title: "Bài trong danh mục", category: cat.slug, status: "published" });
    await rejects(() => admin.blog.categoryRemove({ slug: cat.slug }), "CONFLICT");
    assert.ok((await callerFor({}).blog.categories()).some((c) => c.slug === cat.slug));
  });

  test("a reader cannot touch the categories", async () => {
    await rejects(() => couple.a.caller.blog.categoryCreate({ name: "Của người đọc" }), "FORBIDDEN");
    await rejects(() => callerFor({}).blog.categoryRemove({ slug: "tin-tuc" }), "UNAUTHORIZED");
  });

  test("the featured shelf holds only featured, live posts", async () => {
    await admin.blog.create({ title: "Bài nổi bật", featured: true, status: "published" });
    await admin.blog.create({ title: "Bài nổi bật nhưng nháp", featured: true, status: "draft" });
    const shelf = await callerFor({}).blog.featured();
    assert.ok(shelf.some((p) => p.title === "Bài nổi bật"));
    assert.ok(!shelf.some((p) => p.title === "Bài nổi bật nhưng nháp"), "a draft reached the shelf");
    assert.ok(shelf.every((p) => p.featured));
  });

  test("the popular shelf is ordered by views", async () => {
    const quiet = await admin.blog.create({ title: "Ít ai đọc", status: "published" });
    const loud = await admin.blog.create({ title: "Nhiều người đọc", status: "published" });
    const anon = callerFor({});
    for (let i = 0; i < 3; i++) await anon.blog.recordView({ slug: loud.slug });
    await anon.blog.recordView({ slug: quiet.slug });

    const shelf = await anon.blog.popular({ limit: 10 });
    const iLoud = shelf.findIndex((p) => p.slug === loud.slug);
    const iQuiet = shelf.findIndex((p) => p.slug === quiet.slug);
    assert.ok(iLoud >= 0 && iQuiet >= 0);
    assert.ok(iLoud < iQuiet, "the more-read post must come first");
  });
});
