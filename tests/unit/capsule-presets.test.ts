/*
 * The time-capsule form's presets: unlock dates from a span, titles from the
 * choice, letter starters. The date arithmetic is where a wrong answer hides —
 * a month added to the 31st, a year added to 29 February.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { addMonthsKey, addStarter, capsuleTitle } from "@/lib/capsule-presets";
import { dayKeyLabel } from "@/lib/date-keys";

describe("addMonthsKey", () => {
  test("ordinary spans", () => {
    assert.equal(addMonthsKey("2026-11-02", 1), "2026-12-02");
    assert.equal(addMonthsKey("2026-11-02", 6), "2027-05-02");
    assert.equal(addMonthsKey("2026-11-02", 12), "2027-11-02");
    assert.equal(addMonthsKey("2026-11-02", 36), "2029-11-02");
  });
  test("the 31st holds to the end of a shorter month, never spills into the next", () => {
    assert.equal(addMonthsKey("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonthsKey("2028-01-31", 1), "2028-02-29");
    assert.equal(addMonthsKey("2026-08-31", 1), "2026-09-30");
  });
  test("29 February a year on is 28 February", () => {
    assert.equal(addMonthsKey("2028-02-29", 12), "2029-02-28");
  });
  test("across the year boundary", () => {
    assert.equal(addMonthsKey("2026-12-15", 1), "2027-01-15");
  });
});

describe("titles and starters", () => {
  test("a span, an occasion, and a partner with no name yet", () => {
    assert.equal(capsuleTitle("An", { span: "1 năm" }), "Gửi An của 1 năm sau");
    assert.equal(capsuleTitle("An", { occasion: "Ngày yêu nhau" }), "Gửi An nhân Ngày yêu nhau");
    assert.equal(capsuleTitle("  ", { span: "6 tháng" }), "Gửi người ấy của 6 tháng sau");
    assert.ok(capsuleTitle("An", { occasion: "x".repeat(300) }).length <= 100, "the server's title limit");
  });
  test("a starter goes on its own paragraph after what is written", () => {
    assert.equal(addStarter("", "Cảm ơn vì…"), "Cảm ơn vì…");
    assert.equal(addStarter("Chào em.\n\n  ", "Cảm ơn vì…"), "Chào em.\n\nCảm ơn vì…");
  });
  test("a day for a chip", () => {
    assert.equal(dayKeyLabel("2027-02-14"), "14/02/2027");
  });
});
