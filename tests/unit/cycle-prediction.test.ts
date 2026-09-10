import { test } from "node:test";
import assert from "node:assert/strict";
import { predictNextStart } from "@/lib/cycle-prediction";
import { addDaysKey, daysBetweenKeys } from "@/lib/date-keys";

/*
 * The most private thing the app stores, and the one whose arithmetic nobody
 * can eyeball. Recent cycles count for more than old ones, gaps that cannot be
 * a cycle are thrown out rather than dragging the average, and a prediction
 * that has already passed is rolled forward instead of shown in the past.
 */

test("dưới hai lần ghi thì chưa đoán được gì", () => {
  assert.equal(predictNextStart([], "2026-09-10"), null);
  assert.equal(predictNextStart(["2026-08-01"], "2026-09-10"), null);
});

test("khoảng cách vô lý bị loại, và nếu loại hết thì không đoán", () => {
  // 10 ngày là quá ngắn, 60 ngày là quá dài — không cái nào là một chu kỳ.
  assert.equal(predictNextStart(["2026-08-01", "2026-08-11"], "2026-09-10"), null);
  assert.equal(predictNextStart(["2026-06-01", "2026-07-31"], "2026-09-10"), null);
});

test("ba lần đều 28 ngày thì đoán đúng 28 ngày sau lần cuối", () => {
  const p = predictNextStart(["2026-07-05", "2026-08-02", "2026-08-30"], "2026-09-01");
  assert.ok(p);
  assert.equal(p!.cycleDays, 28);
  assert.equal(p!.nextStart, "2026-09-27");
  assert.equal(p!.samples, 2);
  assert.equal(p!.shortestCycle, 28);
  assert.equal(p!.longestCycle, 28);
  assert.equal(p!.windowStart, p!.nextStart, "chu kỳ đều thì cửa sổ thu về một ngày");
  assert.equal(p!.windowEnd, p!.nextStart);
});

test("lần gần đây được tính nặng hơn lần cũ", () => {
  // Hai khoảng: 30 ngày (cũ) rồi 26 ngày (mới). Trung bình thường là 28,
  // nhưng ưu tiên lần gần thì ra 27.
  const p = predictNextStart(["2026-07-01", "2026-07-31", "2026-08-26"], "2026-08-27");
  assert.ok(p);
  assert.equal(p!.cycleDays, 27);
  assert.equal(p!.shortestCycle, 26);
  assert.equal(p!.longestCycle, 30);
});

test("cửa sổ dự kiến trải từ chu kỳ ngắn nhất tới dài nhất", () => {
  const p = predictNextStart(["2026-07-01", "2026-07-31", "2026-08-26"], "2026-08-27")!;
  assert.equal(p.windowStart, addDaysKey(p.nextStart, -(p.cycleDays - p.shortestCycle)));
  assert.equal(p.windowEnd, addDaysKey(p.nextStart, p.longestCycle - p.cycleDays));
  assert.ok(p.windowStart <= p.nextStart && p.nextStart <= p.windowEnd);
});

test("bỏ lâu không ghi thì lời đoán được đẩy tới tương lai, không nằm ở quá khứ", () => {
  const p = predictNextStart(["2026-01-01", "2026-01-29"], "2026-09-10");
  assert.ok(p);
  assert.ok(daysBetweenKeys(p!.nextStart, "2026-09-10") <= 0, `nextStart ${p!.nextStart} không được ở trước hôm nay`);
});

test("ngày trùng bị gộp, và thứ tự đưa vào không quan trọng", () => {
  const messy = predictNextStart(["2026-08-30", "2026-07-05", "2026-08-02", "2026-08-02"], "2026-09-01");
  const tidy = predictNextStart(["2026-07-05", "2026-08-02", "2026-08-30"], "2026-09-01");
  assert.deepEqual(messy, tidy);
});
