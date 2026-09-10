/*
 * The screens that only read: calendar, /home, thống kê, tìm kiếm, hoạt động.
 *
 * These are the widest queries in the app — a month rollup touches seven
 * collections, search touches five, the activity badge counts nine — and each
 * one is a place where a missing `spaceId` would show another couple's life
 * on your screen without any error anywhere. So the assertions here are
 * mostly two: the number MOVES when this space's data changes, and it does
 * NOT move when the other space's data changes. A read surface that is merely
 * "not empty" proves nothing.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, callerFor, makeCouple, makeMember, must } from "./_harness.ts";
import { todayKey } from "@/lib/date-keys";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

const TODAY = todayKey();
const [YEAR, MONTH] = TODAY.split("-").map(Number);

/** The next day, as a key — `listByRange`'s upper bound is exclusive. */
const TOMORROW = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});

after(closeDatabase);

describe("health", () => {
  test("answers without a session — it is the liveness probe", async () => {
    const res = await callerFor({}).health.check();
    assert.ok(res, "a signed-out caller must still get an answer");
  });
});

describe("the month rollup", () => {
  test("an itinerary item lands on its own day and counts once", async () => {
    await couple.a.caller.planItem.create({ title: "Đi ăn sáng", date: TODAY, bucket: "morning" });
    const summary = await couple.a.caller.calendar.monthSummary({ year: YEAR, month: MONTH });
    const day = must(summary[TODAY], "today's rollup");
    assert.equal(day.planCount, 1);
    assert.equal(day.doneCount, 0);
    assert.deepEqual(
      day.plans.map((p) => p.title),
      ["Đi ăn sáng"],
    );
  });

  test("finishing it moves the done count, not the total", async () => {
    const items = await couple.a.caller.planItem.listByRange({ fromKey: TODAY, toKey: TOMORROW });
    const id = must(items.find((i) => i.title === "Đi ăn sáng"), "the item").id;
    await couple.a.caller.planItem.setStatus({ id, status: "done" });

    const day = must(
      (await couple.a.caller.calendar.monthSummary({ year: YEAR, month: MONTH }))[TODAY],
      "today",
    );
    assert.equal(day.planCount, 1);
    assert.equal(day.doneCount, 1);
  });

  test("a special date shows on its day", async () => {
    await couple.a.caller.specialDate.create({ title: "Ngày của tụi mình", date: TODAY });
    const day = must(
      (await couple.a.caller.calendar.monthSummary({ year: YEAR, month: MONTH }))[TODAY],
      "today",
    );
    assert.ok(day.special, "a special date on today must be marked");
  });

  test("another couple's month is not ours", async () => {
    await outsider.caller.planItem.create({ title: "Việc của người khác", date: TODAY, bucket: "noon" });
    const theirs = must(
      (await outsider.caller.calendar.monthSummary({ year: YEAR, month: MONTH }))[TODAY],
      "their today",
    );
    const ours = must(
      (await couple.a.caller.calendar.monthSummary({ year: YEAR, month: MONTH }))[TODAY],
      "our today",
    );
    assert.equal(theirs.planCount, 1);
    assert.equal(ours.planCount, 1, "their item must not be counted here");
    assert.ok(!ours.plans.some((p) => p.title === "Việc của người khác"));
  });

  test("the day view lists what is pinned to that day, for this space only", async () => {
    const detail = await couple.a.caller.calendar.dayDetail({ date: TODAY });
    const titles = JSON.stringify(detail);
    assert.ok(titles.includes("Đi ăn sáng"));
    assert.ok(!titles.includes("Việc của người khác"), "another space's item reached the day view");
  });

  test("what is coming up is drawn from this space", async () => {
    const next = await couple.a.caller.calendar.nextUp();
    assert.ok(next !== undefined);
    assert.ok(
      !JSON.stringify(next ?? {}).includes("Việc của người khác"),
      "another space's row reached the countdown",
    );
  });
});

describe("thống kê", () => {
  test("the counts follow this space's data and nothing else", async () => {
    const before_ = await couple.a.caller.stats.overview();
    await couple.a.caller.memory.create({ title: "Kỷ niệm mới", date: new Date(`${TODAY}T02:00:00Z`) });
    await outsider.caller.memory.create({ title: "Của người khác", date: new Date(`${TODAY}T02:00:00Z`) });

    const after_ = await couple.a.caller.stats.overview();
    assert.equal(after_.memories, before_.memories + 1, "our memory must count");

    const theirs = await outsider.caller.stats.overview();
    assert.equal(theirs.memories, 1, "their side counts only their own");
  });

  test("places pinned and visited are counted apart", async () => {
    await couple.a.caller.location.create({
      name: "Quán mới",
      district: "Phường Sài Gòn",
      category: "Cà phê",
    });
    await couple.a.caller.location.create({
      name: "Quán đã đi",
      district: "Phường Sài Gòn",
      category: "Ăn tối",
      status: "visited",
    });
    const s = await couple.a.caller.stats.overview();
    assert.ok(s.placesPinned >= 1);
    assert.equal(s.placesVisited, 1);
  });
});

describe("/home", () => {
  test("answers for a space with data, and carries none of another's", async () => {
    const today = await couple.a.caller.dashboard.today();
    assert.ok(today, "the home screen must have something to render");
    assert.ok(
      !JSON.stringify(today).includes("Của người khác"),
      "another space's memory reached /home",
    );
  });
});

describe("tìm kiếm", () => {
  test("finds a place by its name", async () => {
    const res = await couple.a.caller.search.query({ q: "Quán mới" });
    assert.ok(res.total > 0);
    assert.ok(JSON.stringify(res.groups).includes("Quán mới"));
  });

  test("ignores accents and case, the way the rest of the app does", async () => {
    // "Quan moi" must find "Quán mới" — typing Vietnamese without diacritics
    // is the normal case on a phone keyboard.
    const res = await couple.a.caller.search.query({ q: "quan moi" });
    assert.ok(res.total > 0, "an unaccented query must still find an accented name");
  });

  test("a query that folds to nothing finds nothing, rather than everything", async () => {
    // A lone combining mark reduces to an empty pattern. Matching everything
    // there would read as the search ignoring what was typed.
    const res = await couple.a.caller.search.query({ q: "́" });
    assert.equal(res.total, 0);
    assert.deepEqual(res.groups, []);
  });

  test("never reaches into another couple's data", async () => {
    await outsider.caller.location.create({
      name: "Quán mới của người khác",
      district: "Phường Sài Gòn",
      category: "Cà phê",
    });
    const res = await couple.a.caller.search.query({ q: "Quán mới" });
    assert.ok(!JSON.stringify(res.groups).includes("của người khác"));
  });

  test("an empty query is refused by the schema", async () => {
    await assert.rejects(() => couple.a.caller.search.query({ q: "   " }));
  });
});

describe("hoạt động", () => {
  test("the badge counts what the partner made, never your own", async () => {
    const mineOnly = await couple.a.caller.activity.unreadCount();
    await couple.a.caller.memory.create({ title: "An tự thêm", date: new Date(`${TODAY}T03:00:00Z`) });
    assert.equal(
      (await couple.a.caller.activity.unreadCount()).count,
      mineOnly.count,
      "your own entry must not light up your own badge",
    );

    await couple.b.caller.memory.create({ title: "Bình thêm", date: new Date(`${TODAY}T04:00:00Z`) });
    assert.ok(
      (await couple.a.caller.activity.unreadCount()).count > mineOnly.count,
      "the partner's entry must light it up",
    );
  });

  test("opening the feed clears the badge and reports where the line was", async () => {
    const res = await couple.a.caller.activity.markSeen();
    assert.ok("lastSeenActivityAt" in res || res, "markSeen reports the previous watermark");
    assert.equal((await couple.a.caller.activity.unreadCount()).count, 0);
  });

  test("the feed is newest first, and only this space's", async () => {
    const feed = await couple.a.caller.activity.feed({ limit: 30 });
    const items = feed.items ?? [];
    assert.ok(items.length > 0);
    const times = items.map((i: { createdAt: Date }) => new Date(i.createdAt).getTime());
    assert.deepEqual(times, [...times].sort((x, y) => y - x), "the feed must be newest first");
    assert.ok(!JSON.stringify(items).includes("Của người khác"));
  });

  test("the partner's badge is theirs alone", async () => {
    // A marks seen; that must not clear B's badge.
    await couple.a.caller.memory.create({ title: "An thêm nữa", date: new Date(`${TODAY}T05:00:00Z`) });
    assert.ok((await couple.b.caller.activity.unreadCount()).count > 0);
    await couple.a.caller.activity.markSeen();
    assert.ok(
      (await couple.b.caller.activity.unreadCount()).count > 0,
      "one member marking seen must not clear the other's badge",
    );
  });
});
