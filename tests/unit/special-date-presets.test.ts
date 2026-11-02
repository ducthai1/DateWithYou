/*
 * "Ngày đặc biệt" presets: a fixed holiday lands on its NEXT occurrence, so
 * the countdown it starts is never "−300 ngày", and a day already on the list
 * is not offered again.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DATE_PRESETS, freshPresets, nextMonthDay } from "@/lib/special-date-presets";

test("a fixed day still ahead this year is this year's", () => {
  assert.equal(nextMonthDay("2026-11-02", "12-24"), "2026-12-24");
});

test("one already past rolls to next year", () => {
  assert.equal(nextMonthDay("2026-11-02", "02-14"), "2027-02-14");
  assert.equal(nextMonthDay("2026-11-02", "10-20"), "2027-10-20");
});

test("on the day itself it is today, not a year away", () => {
  assert.equal(nextMonthDay("2027-02-14", "02-14"), "2027-02-14");
});

test("a preset already on the list is not offered, however it was typed", () => {
  const left = freshPresets(["valentine", "NGAY YEU NHAU"]);
  assert.ok(!left.some((p) => p.title === "Valentine" || p.title === "Ngày yêu nhau"));
  assert.equal(left.length, DATE_PRESETS.length - 2);
});

test("every fixed day is a real MM-DD", () => {
  for (const p of DATE_PRESETS.filter((p) => p.monthDay)) assert.match(p.monthDay!, /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, p.title);
});
