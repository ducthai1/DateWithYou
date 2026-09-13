import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  parseDayKey,
  openingMonth,
  yearOptions,
  isOutOfRange,
  monthGrid,
  formatDisplay,
} from "../../src/lib/date-picker-range.ts";

/*
 * The date picker is used for a birthday and for a trip, and those two want
 * opposite things from the same control: one reaches back a century and must
 * refuse tomorrow, the other looks forward and has no floor at all. Everything
 * that decides between them is here, so this is where it is pinned.
 *
 * Each case below is one that has actually gone wrong, or would have: the year
 * list was a fixed range, the view was read once at mount and then ignored the
 * value that arrived later, and a bare `new Date("1998-06-15")` reads as UTC
 * midnight — which is the 14th for anyone west of Greenwich.
 */

test("day keys round-trip through local time, never UTC", () => {
  assert.equal(dayKey(new Date(1998, 5, 15)), "1998-06-15");
  const back = parseDayKey("1998-06-15")!;
  assert.equal(back.getFullYear(), 1998);
  assert.equal(back.getMonth(), 5);
  assert.equal(back.getDate(), 15, "a bare date string parsed as UTC lands on the 14th");
});

test("a day that does not exist is not a day", () => {
  assert.equal(parseDayKey("2025-02-30"), null, "the Date constructor would roll this into March");
  assert.equal(parseDayKey("1998-6-15"), null, "zero-padding is part of the format");
  assert.equal(parseDayKey(""), null);
  assert.equal(parseDayKey(undefined), null);
});

test("the calendar opens on the value, then the default view, then today", () => {
  const today = new Date(2026, 8, 13);

  // A birthday that arrives after mount, from a query: the view must follow it.
  assert.equal(dayKey(openingMonth("1998-06-15", "2000-01-01", today)), "1998-06-01");

  // Nothing chosen yet: Settings starts the birthday field in 2000 rather than
  // this morning, which is three hundred months of paging away.
  assert.equal(dayKey(openingMonth("", "2000-01-01", today)), "2000-01-01");

  // No hint at all — a date near now, so today's month is right.
  assert.equal(dayKey(openingMonth("", undefined, today)), "2026-09-01");

  // Always the 1st: stepping back from the 31st must not skip a month.
  assert.equal(dayKey(openingMonth("2026-01-31", undefined, today)), "2026-01-01");
});

test("the year list is bounded by the same props that bound the days", () => {
  const today = new Date(2026, 8, 13);

  // A birthday: floor 1920, ceiling today.
  const birthday = yearOptions({ min: "1920-01-01", max: "2026-09-13", viewYear: 2000, today });
  assert.equal(birthday[0], 1920);
  assert.equal(birthday.at(-1), 2026);
  assert.equal(birthday.length, 107);

  // A trip passes neither bound: a century back, ten years on.
  const trip = yearOptions({ viewYear: 2026, today });
  assert.equal(trip.at(-1), 2036);
  assert.equal(trip[0], 1936);

  // A stored value outside the bounds must still be selectable, or the select
  // displays a year that is not one of its options.
  const stale = yearOptions({ min: "1920-01-01", max: "2026-09-13", viewYear: 2040, today });
  assert.equal(stale.at(-1), 2040);
});

test("both bounds disable days, and neither bound disables none", () => {
  const birthday = { min: "1920-01-01", max: "2026-09-13" };
  assert.equal(isOutOfRange("2026-09-14", birthday), true, "tomorrow is not a birthday");
  assert.equal(isOutOfRange("2026-09-13", birthday), false, "the bounds are inclusive");
  assert.equal(isOutOfRange("1919-12-31", birthday), true);
  assert.equal(isOutOfRange("1920-01-01", birthday), false);
  assert.equal(isOutOfRange("1850-01-01", {}), false, "no bounds, no refusals");
});

test("month geometry: leap day, and the weekday a month starts on", () => {
  assert.equal(monthGrid(1998, 5).daysInMonth, 30, "June");
  assert.equal(monthGrid(2024, 1).daysInMonth, 29, "February in a leap year");
  assert.equal(monthGrid(2025, 1).daysInMonth, 28);
  assert.equal(monthGrid(2000, 1).daysInMonth, 29, "2000 is a leap year; 1900 was not");
  assert.equal(monthGrid(2026, 8).firstWeekday, 2, "1 Sep 2026 is a Tuesday");
});

test("the trigger shows the date, or says nothing is set", () => {
  assert.equal(formatDisplay("1998-06-15", "Chưa đặt"), "15/06/1998");
  assert.equal(formatDisplay("2026-01-05", "Chưa đặt"), "05/01/2026");
  assert.equal(formatDisplay("", "Chưa đặt"), "Chưa đặt", "an empty birthday is not today");
  assert.equal(formatDisplay(undefined, "Chọn ngày"), "Chọn ngày");
});
