import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysKey,
  dateKeyFromDate,
  dayRangeUtc,
  daysBetweenKeys,
  monthDayOf,
  monthGridWeeks,
  monthKeyRange,
  monthRangeUtc,
  saigonMidnightUtc,
  weekDaysOf,
} from "../../src/lib/date-keys.ts";

/*
 * Day bucketing, pinned to Saigon.
 *
 * The server runs in UTC and the couple lives at UTC+7, so anything that asks
 * a Date which day it is has to go through this file. The cases below are the
 * ones where a naive `getDate()` gives the wrong day: late evening local time
 * (still the previous day in UTC) and the first hours after midnight.
 */

test("dateKeyFromDate: buổi tối ở Sài Gòn vẫn là ngày hôm đó, dù UTC đã lùi", () => {
  // 2026-09-10 23:30 Saigon = 2026-09-10 16:30 UTC
  assert.equal(dateKeyFromDate("2026-09-10T16:30:00.000Z"), "2026-09-10");
  // 2026-09-10 00:30 Saigon = 2026-09-09 17:30 UTC — UTC nói mùng 9, ta nói mùng 10
  assert.equal(dateKeyFromDate("2026-09-09T17:30:00.000Z"), "2026-09-10");
  // Ngay trước nửa đêm Sài Gòn
  assert.equal(dateKeyFromDate("2026-09-10T16:59:59.999Z"), "2026-09-10");
  // Ngay sau nửa đêm Sài Gòn
  assert.equal(dateKeyFromDate("2026-09-10T17:00:00.000Z"), "2026-09-11");
});

test("dateKeyFromDate: luôn ra đúng dạng YYYY-MM-DD, có đệm số 0", () => {
  assert.equal(dateKeyFromDate("2026-01-05T03:00:00.000Z"), "2026-01-05");
  assert.match(dateKeyFromDate(new Date()), /^\d{4}-\d{2}-\d{2}$/);
});

test("saigonMidnightUtc: nửa đêm ở Sài Gòn là 17:00 UTC hôm trước", () => {
  assert.equal(saigonMidnightUtc(2026, 9, 10).toISOString(), "2026-09-09T17:00:00.000Z");
});

test("dayRangeUtc: khoảng nửa mở, đúng 24 giờ", () => {
  const { from, to } = dayRangeUtc("2026-09-10");
  assert.equal(to.getTime() - from.getTime(), 86_400_000);
  assert.equal(dateKeyFromDate(from), "2026-09-10");
});

test("monthRangeUtc: vắt qua năm mới vẫn đúng", () => {
  const dec = monthRangeUtc(2026, 12);
  assert.equal(dateKeyFromDate(dec.from), "2026-12-01");
  assert.equal(dateKeyFromDate(dec.to), "2027-01-01");
});

test("monthKeyRange: mốc chuỗi bao trọn tháng, kể cả tháng 12", () => {
  assert.deepEqual(monthKeyRange(2026, 9), { fromKey: "2026-09-00", toKey: "2026-10-00" });
  assert.deepEqual(monthKeyRange(2026, 12), { fromKey: "2026-12-00", toKey: "2027-01-00" });
  const { fromKey, toKey } = monthKeyRange(2026, 9);
  for (const k of ["2026-09-01", "2026-09-30"]) {
    assert.ok(k > fromKey && k < toKey, k);
  }
});

test("addDaysKey: qua cuối tháng, cuối năm, và năm nhuận", () => {
  assert.equal(addDaysKey("2026-09-30", 1), "2026-10-01");
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysKey("2027-01-01", -1), "2026-12-31");
  assert.equal(addDaysKey("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysKey("2026-02-28", 1), "2026-03-01");
});

test("daysBetweenKeys: đếm đúng và có dấu", () => {
  assert.equal(daysBetweenKeys("2026-09-10", "2026-09-11"), 1);
  assert.equal(daysBetweenKeys("2026-09-11", "2026-09-10"), -1);
  assert.equal(daysBetweenKeys("2026-09-10", "2026-09-10"), 0);
  assert.equal(daysBetweenKeys("2026-12-31", "2027-01-01"), 1);
});

test("weekDaysOf: bảy ngày liên tiếp, bắt đầu từ thứ Hai", () => {
  const week = weekDaysOf("2026-09-10");
  assert.equal(week.length, 7);
  assert.equal(week[0], "2026-09-07");
  assert.equal(week[6], "2026-09-13");
  week.forEach((k, i) => assert.equal(k, addDaysKey(week[0], i)));
});

test("monthGridWeeks: lưới đủ tuần, mỗi tuần 7 ô, và chứa trọn tháng", () => {
  const weeks = monthGridWeeks(2026, 9);
  assert.ok(weeks.length >= 4 && weeks.length <= 6, String(weeks.length));
  for (const w of weeks) assert.equal(w.length, 7);
  const keys = weeks.flat().map((c) => c.key);
  assert.ok(keys.includes("2026-09-01"), "thiếu ngày đầu tháng");
  assert.ok(keys.includes("2026-09-30"), "thiếu ngày cuối tháng");
  // Liên tục, không hụt không lặp.
  keys.forEach((k, i) => { if (i > 0) assert.equal(k, addDaysKey(keys[i - 1], 1), `đứt ở ${k}`); });
  const inMonth = weeks.flat().filter((c) => c.inMonth).map((c) => c.key);
  assert.equal(inMonth.length, 30, "tháng 9 phải có 30 ngày trong tháng");
});

test("monthDayOf: lấy MM-DD để so ngày kỷ niệm hằng năm", () => {
  assert.equal(monthDayOf("2026-09-10"), "09-10");
});
