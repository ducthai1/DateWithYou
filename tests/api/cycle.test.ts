/*
 * The quiet corner: period starts in, rhythm out.
 *
 * Nothing here is derived at write time — the rhythm and the next expected
 * date are computed from the stored days on every read, so what has to hold
 * is that the stored list stays clean: dates only, sorted, no duplicates, and
 * nothing impossible. A typo'd year landing decades out would sit at the top
 * of the countdown, and a future start would make the prediction nonsense,
 * so both are refused — and refused SOFTLY, with a reason, because the panel
 * shows a message rather than an error.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, rejects } from "./_harness.ts";
import { todayKey } from "@/lib/date-keys";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});

after(closeDatabase);

/** N days from a YYYY-MM-DD key, as another key. */
function shift(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("recording a start", () => {
  test("nothing stored means no prediction, not a made-up date", async () => {
    const seen = await couple.a.caller.cycle.get();
    assert.deepEqual(seen.starts, []);
    assert.equal(seen.prediction, null);
  });

  test("one date is not a rhythm yet", async () => {
    await couple.a.caller.cycle.addStart({ date: "2026-06-01" });
    const seen = await couple.a.caller.cycle.get();
    assert.deepEqual(seen.starts, ["2026-06-01"]);
    assert.equal(seen.prediction, null, "a rhythm needs two dates to measure between");
  });

  test("the same day twice is one entry", async () => {
    await couple.a.caller.cycle.addStart({ date: "2026-06-01" });
    await couple.a.caller.cycle.addStart({ date: "2026-06-01" });
    assert.deepEqual((await couple.a.caller.cycle.get()).starts, ["2026-06-01"]);
  });

  test("dates come back sorted, whatever order they went in", async () => {
    await couple.a.caller.cycle.addStart({ date: "2026-07-29" });
    await couple.a.caller.cycle.addStart({ date: "2026-06-30" });
    assert.deepEqual((await couple.a.caller.cycle.get()).starts, [
      "2026-06-01",
      "2026-06-30",
      "2026-07-29",
    ]);
  });

  test("two dates give a next expected day", async () => {
    const seen = await couple.a.caller.cycle.get();
    assert.ok(seen.prediction, "two starts 29 days apart is a rhythm");
  });

  test("either partner may record it — it is the couple's panel", async () => {
    await couple.b.caller.cycle.addStart({ date: "2026-08-27" });
    assert.ok((await couple.a.caller.cycle.get()).starts.includes("2026-08-27"));
  });

  test("a mistyped entry can be taken back", async () => {
    await couple.a.caller.cycle.removeStart({ date: "2026-08-27" });
    assert.ok(!(await couple.a.caller.cycle.get()).starts.includes("2026-08-27"));
  });
});

describe("what will not be stored", () => {
  test("tomorrow is refused, with a reason rather than an error", async () => {
    /*
     * Soft, not thrown: the panel shows words. An error here would surface as
     * a toast about something going wrong, which is not what happened.
     */
    const res = await couple.a.caller.cycle.addStart({ date: shift(todayKey(), 1) });
    assert.deepEqual(res, { ok: false, reason: "out-of-range" });
    assert.ok(!(await couple.a.caller.cycle.get()).starts.includes(shift(todayKey(), 1)));
  });

  test("today itself is fine — that is the normal case", async () => {
    const res = await couple.a.caller.cycle.addStart({ date: todayKey() });
    assert.deepEqual(res, { ok: true });
    assert.ok((await couple.a.caller.cycle.get()).starts.includes(todayKey()));
    await couple.a.caller.cycle.removeStart({ date: todayKey() });
  });

  test("a year from the last century is refused", async () => {
    const res = await couple.a.caller.cycle.addStart({ date: "1999-12-31" });
    assert.deepEqual(res, { ok: false, reason: "out-of-range" });
  });

  test("anything that is not a plain YYYY-MM-DD never reaches the handler", async () => {
    await rejects(() => couple.a.caller.cycle.addStart({ date: "01/06/2026" }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.cycle.addStart({ date: "2026-6-1" }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.cycle.removeStart({ date: "hôm nay" }), "BAD_REQUEST");
  });
});

describe("another couple", () => {
  test("keeps its own dates, and cannot remove ours", async () => {
    assert.deepEqual((await outsider.caller.cycle.get()).starts, []);
    await outsider.caller.cycle.addStart({ date: "2026-05-05" });
    await outsider.caller.cycle.removeStart({ date: "2026-06-01" });

    assert.deepEqual((await outsider.caller.cycle.get()).starts, ["2026-05-05"]);
    assert.ok(
      (await couple.a.caller.cycle.get()).starts.includes("2026-06-01"),
      "another space removed one of our dates",
    );
  });
});
