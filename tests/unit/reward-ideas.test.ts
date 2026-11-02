/*
 * The ideas row of Phiếu bé ngoan: what it offers, and that what is already
 * on the list is not offered again however it was typed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { TASK_IDEAS, VOUCHER_IDEAS, TASK_POINT_PRESETS, VOUCHER_POINT_PRESETS, freshIdeas } from "@/lib/reward-ideas";

test("a task already on the list drops out, whatever its accents, case or spaces", () => {
  const left = freshIdeas(TASK_IDEAS, ["  RUA BAT ", "nấu   bữa tối"]);
  assert.ok(!left.some((i) => i.title === "Rửa bát"));
  assert.ok(!left.some((i) => i.title === "Nấu bữa tối"));
  assert.equal(left.length, TASK_IDEAS.length - 2);
});

test("ideas are on the panel's scale: cheap tasks, vouchers worth a few of them", () => {
  for (const i of TASK_IDEAS) assert.ok(i.points >= 5 && i.points <= 20, i.title);
  for (const i of VOUCHER_IDEAS) assert.ok(i.points >= 30 && i.points <= 200, i.title);
  assert.ok(TASK_POINT_PRESETS.includes(10), "the panel's old default stays a chip");
  assert.ok(VOUCHER_POINT_PRESETS.includes(50), "the panel's old default stays a chip");
});

test("no idea is listed twice", () => {
  for (const list of [TASK_IDEAS, VOUCHER_IDEAS]) {
    assert.equal(new Set(list.map((i) => i.title)).size, list.length);
  }
});
