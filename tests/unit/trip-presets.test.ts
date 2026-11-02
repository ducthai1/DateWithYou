/*
 * Trip form presets: a length chip and the dates must agree both ways — the
 * chip sets the end, and the dates light up the chip they match.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PACKING_IDEAS, TRIP_LENGTHS, freshPacking, tripDays, tripEnd } from "@/lib/trip-presets";

test("3N2Đ from a Friday ends on the Sunday", () => {
  assert.equal(tripEnd("2026-11-06", 3), "2026-11-08");
  assert.equal(tripDays("2026-11-06", "2026-11-08"), 3);
});

test("a day trip starts and ends on the same day", () => {
  assert.equal(tripEnd("2026-11-06", 1), "2026-11-06");
  assert.equal(tripDays("2026-11-06", "2026-11-06"), 1);
});

test("across a month and a year end", () => {
  assert.equal(tripEnd("2026-12-30", 4), "2027-01-02");
  assert.equal(tripDays("2026-12-30", "2027-01-02"), 4);
});

test("every length chip maps back to itself", () => {
  for (const l of TRIP_LENGTHS) assert.equal(tripDays("2026-11-06", tripEnd("2026-11-06", l.days)), l.days, l.label);
});

test("packing ideas already on the list are not offered again", () => {
  const left = freshPacking(["sac du phong", "  KEM CHỐNG NẮNG "]);
  assert.ok(!left.includes("Sạc dự phòng") && !left.includes("Kem chống nắng"));
  assert.equal(left.length, PACKING_IDEAS.length - 2);
});
