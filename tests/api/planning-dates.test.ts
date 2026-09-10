/*
 * Dates, buckets and order — the parts of planning that are only ever wrong
 * by one.
 *
 * A day here is a `YYYY-MM-DD` string, deliberately: it is the Saigon-local
 * day the couple means, not an instant, and the moment a real Date reaches
 * one of these fields the pages that split it crash. The range query is
 * half-open. Order inside a bucket has to survive ties in old data. A picked
 * time overrules the bucket that came with it. None of that is guessable from
 * the field names, so it is written down here.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, callerFor, makeCouple, makeMember, newUserId, rejects } from "./_harness.ts";
import { todayKey } from "@/lib/date-keys";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});

after(closeDatabase);

const plan = (over: Record<string, unknown> = {}) =>
  couple.a.caller.planItem.create({ title: "Đi ăn", date: "2026-04-10", bucket: "morning", ...over });

const idsOn = async (date: string, bucket: string) =>
  (await couple.a.caller.planItem.listByRange({ fromKey: date, toKey: "2026-12-31" }))
    .filter((d: { date: string; bucket: string }) => d.date === date && d.bucket === bucket)
    .map((d: { id: string }) => d.id);

describe("what counts as a day", () => {
  test("a day is a plain YYYY-MM-DD string, and anything else is refused", async () => {
    await rejects(() => plan({ date: "10/04/2026" }), "BAD_REQUEST");
    await rejects(() => plan({ date: "2026-4-10" }), "BAD_REQUEST");
    await rejects(
      () => couple.a.caller.specialDate.create({ title: "Ngày", date: "2026-4-1" }),
      "BAD_REQUEST",
    );
  });

  test("a special date comes back as the same string it went in as", async () => {
    /*
     * Not a Date. The home page splits this value on "-"; a Date object put
     * here by a seed script is what took /home down before.
     */
    const { id } = await couple.a.caller.specialDate.create({ title: "Ngày mình quen", date: "2026-02-14" });
    const row = (await couple.a.caller.specialDate.list()).find((d) => d.id === id);
    assert.equal(typeof row?.date, "string");
    assert.equal(row?.date, "2026-02-14");
    assert.equal(typeof row?.daysUntil, "number");
  });

  test("the range query includes its start and stops before its end", async () => {
    await plan({ date: "2026-07-01", title: "Ngày đầu" });
    await plan({ date: "2026-07-31", title: "Ngày cuối" });
    const inclusive = await couple.a.caller.planItem.listByRange({ fromKey: "2026-07-01", toKey: "2026-08-01" });
    assert.deepEqual(
      inclusive.filter((d: { date: string }) => d.date.startsWith("2026-07")).map((d: { title: string }) => d.title).sort(),
      ["Ngày cuối", "Ngày đầu"],
    );

    const halfOpen = await couple.a.caller.planItem.listByRange({ fromKey: "2026-07-01", toKey: "2026-07-31" });
    assert.ok(
      !halfOpen.some((d: { title: string }) => d.title === "Ngày cuối"),
      "toKey is exclusive — a month view must ask for the 1st of the next month",
    );
  });
});

describe("a birthday belongs to the person, not to one space", () => {
  test("setting it once writes a row in every space that person is in", async () => {
    /*
     * A birthday used to be one calendar row in whichever space happened to
     * be open when it was typed — a second space never heard of it, and
     * leaving and rejoining lost it. It now lives on the account and the
     * calendar rows are derived from it, one per space, rewritten on save.
     */
    const home = await makeMember({ name: "Em", spaceName: "Góc thứ nhất" });
    const second = await callerFor({ userId: home.userId, userEmail: home.email }).space.create({
      name: "Góc thứ hai",
    });
    const inSecond = callerFor({
      userId: home.userId,
      userEmail: home.email,
      activeSpaceId: second.id,
    });

    await home.caller.specialDate.setMyBirthday({ date: "1998-03-21" });

    assert.equal((await home.caller.specialDate.myBirthday()).date, "1998-03-21");
    assert.equal(
      (await inSecond.specialDate.myBirthday()).date,
      "1998-03-21",
      "the birthday is a fact about the person, so the other space knows it too",
    );

    for (const [where, c] of [["first", home.caller], ["second", inSecond]] as const) {
      const rows = (await c.specialDate.list()).filter((r) => r.date === "1998-03-21");
      assert.equal(rows.length, 1, `${where} space: exactly one derived row`);
      assert.ok(rows[0].title.startsWith("Sinh nhật"), rows[0].title);
      assert.ok(rows[0].recurYearly, "a birthday comes back every year");
    }

    // Saving the same date again rewrites the row rather than adding another.
    await home.caller.specialDate.setMyBirthday({ date: "1998-03-21" });
    assert.equal((await inSecond.specialDate.list()).filter((r) => r.date === "1998-03-21").length, 1);
  });

  test("nobody is born tomorrow", async () => {
    const today = todayKey();
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const key = tomorrow.toISOString().slice(0, 10);
    await rejects(() => couple.b.caller.specialDate.setMyBirthday({ date: key }), "BAD_REQUEST");
  });

  test("clearing it takes the derived rows away too", async () => {
    await couple.b.caller.specialDate.setMyBirthday({ date: "1997-11-02" });
    assert.ok((await couple.b.caller.specialDate.list()).some((r) => r.date === "1997-11-02"));
    await couple.b.caller.specialDate.setMyBirthday({ date: null });
    assert.equal((await couple.b.caller.specialDate.myBirthday()).date, null);
    assert.ok(!(await couple.b.caller.specialDate.list()).some((r) => r.date === "1997-11-02"));
  });
});

describe("buckets and order", () => {
  test("a picked time decides the bucket, so the two can never disagree", async () => {
    const { id } = await plan({ date: "2026-09-02", bucket: "morning", time: "19:30" });
    const row = (await couple.a.caller.planItem.listByRange({ fromKey: "2026-09-02", toKey: "2026-09-03" })).find(
      (d: { id: string }) => d.id === id,
    );
    assert.equal(row?.bucket, "evening", "19:30 is tối, whatever the form sent");
  });

  test("new cards land at the tail of their bucket", async () => {
    const a = (await plan({ date: "2026-09-10", title: "Một" })).id;
    const b = (await plan({ date: "2026-09-10", title: "Hai" })).id;
    const c = (await plan({ date: "2026-09-10", title: "Ba" })).id;
    assert.deepEqual(await idsOn("2026-09-10", "morning"), [a, b, c]);
  });

  test("moving up swaps with the neighbour and renumbers the bucket", async () => {
    const [a, b, c] = await idsOn("2026-09-10", "morning");
    await couple.a.caller.planItem.move({ id: c, direction: "up" });
    assert.deepEqual(await idsOn("2026-09-10", "morning"), [a, c, b]);
    await couple.a.caller.planItem.move({ id: c, direction: "down" });
    assert.deepEqual(await idsOn("2026-09-10", "morning"), [a, b, c]);
  });

  test("moving at the edge is a no-op, not an error", async () => {
    const [first] = await idsOn("2026-09-10", "morning");
    await couple.a.caller.planItem.move({ id: first, direction: "up" });
    assert.equal((await idsOn("2026-09-10", "morning"))[0], first);
  });

  test("reorder commits the destination and is safe to run twice", async () => {
    const [a, b, c] = await idsOn("2026-09-10", "morning");
    const wanted = [c, a, b];
    const first = await couple.a.caller.planItem.reorder({ date: "2026-09-10", bucket: "morning", ids: wanted });
    assert.deepEqual(await idsOn("2026-09-10", "morning"), wanted);
    assert.ok(first.changed > 0);

    const again = await couple.a.caller.planItem.reorder({ date: "2026-09-10", bucket: "morning", ids: wanted });
    assert.equal(again.changed, 0, "re-sending the same order writes nothing");
    assert.deepEqual(await idsOn("2026-09-10", "morning"), wanted);
  });

  test("a card the client never saw keeps its place instead of being dropped", async () => {
    /*
     * The partner can add a card mid-drag. Naming only the cards this client
     * knows about must not push the unseen one out of the bucket.
     */
    const known = await idsOn("2026-09-10", "morning");
    const late = (await couple.b.caller.planItem.create({
      title: "Bình thêm vào",
      date: "2026-09-10",
      bucket: "morning",
    })).id;
    await couple.a.caller.planItem.reorder({ date: "2026-09-10", bucket: "morning", ids: known });
    const after = await idsOn("2026-09-10", "morning");
    assert.deepEqual(after, [...known, late]);
  });
});

describe("what a card may point at", () => {
  test("an assignee has to be in the space", async () => {
    await rejects(() => plan({ assigneeId: newUserId() }), "BAD_REQUEST");
    await rejects(() => plan({ assigneeId: outsider.userId }), "BAD_REQUEST");
    const ok = await plan({ assigneeId: couple.b.userId });
    assert.ok(ok.id);
  });

  test("a place has to be in the space", async () => {
    const mine = await couple.a.caller.location.create({
      name: "Quán quen",
      district: "Phường Sài Gòn",
      category: "Cà phê",
    });
    const theirs = await outsider.caller.location.create({
      name: "Quán của người khác",
      district: "Phường Sài Gòn",
      category: "Cà phê",
    });
    const ok = await plan({ locationId: mine.id });
    assert.ok(ok.id);
    await rejects(() => plan({ locationId: theirs.id }), "BAD_REQUEST");
  });
});
