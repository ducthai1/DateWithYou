import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUCKETS,
  BUCKET_KEYS,
  BUCKET_ORDER,
  DEFAULT_TAGS,
  bucketForTime,
  colorsForTags,
  mergeTags,
  readableInk,
} from "@/lib/plan-meta";

/*
 * Which half of the day a plan belongs to, and what colour its tag reads as.
 *
 * The buckets are boundaries, so they are tested at the boundary: an item at
 * 11:00 belongs to trưa and one at 10:59 to sáng, and the day wraps through
 * midnight into tối rather than falling out of the list.
 */

test("bucketForTime: đúng ở từng mốc chuyển buổi", () => {
  const cases: [string, string][] = [
    ["05:00", "morning"], ["10:59", "morning"],
    ["11:00", "noon"], ["12:59", "noon"],
    ["13:00", "afternoon"], ["17:59", "afternoon"],
    ["18:00", "evening"], ["23:59", "evening"],
    ["00:00", "evening"], ["04:59", "evening"],
  ];
  for (const [time, want] of cases) assert.equal(bucketForTime(time), want, time);
});

test("bucketForTime: giờ vô nghĩa thì về sáng chứ không rơi ra ngoài", () => {
  for (const bad of ["", "ab:cd", "không phải giờ"]) {
    assert.ok(BUCKET_KEYS.includes(bucketForTime(bad)), bad);
  }
});

test("thứ tự buổi khớp với thứ tự khai trong BUCKETS", () => {
  BUCKETS.forEach((b, i) => assert.equal(BUCKET_ORDER[b.key], i, b.key));
  assert.equal(BUCKET_KEYS.length, BUCKETS.length);
});

test("mergeTags: nhãn mặc định luôn đứng trước, nhãn riêng nối sau", () => {
  const merged = mergeTags([{ name: "Sinh nhật", color: "#123456" }]);
  assert.deepEqual(merged.slice(0, DEFAULT_TAGS.length), DEFAULT_TAGS);
  assert.equal(merged[merged.length - 1].name, "Sinh nhật");
});

test("mergeTags: nhãn riêng trùng tên mặc định thì không nhân đôi, bất kể kiểu chữ", () => {
  const merged = mergeTags([{ name: "hẹn hò", color: "#000000" }, { name: "ĂN UỐNG", color: "#111111" }]);
  assert.equal(merged.length, DEFAULT_TAGS.length);
});

test("mergeTags: không có nhãn riêng thì trả đúng bộ mặc định", () => {
  assert.deepEqual(mergeTags(undefined), DEFAULT_TAGS);
  assert.deepEqual(mergeTags([]), DEFAULT_TAGS);
});

test("readableInk: chữ trắng trên nền tối, chữ đậm trên nền sáng", () => {
  assert.equal(readableInk("#000000"), "#ffffff");
  assert.equal(readableInk("#ffffff"), "#1c1917");
  assert.equal(readableInk("#fff"), "#1c1917", "phải hiểu hex 3 ký tự");
  assert.equal(readableInk("000"), "#ffffff", "thiếu dấu # vẫn đọc được");
  for (const t of DEFAULT_TAGS) {
    assert.ok(["#ffffff", "#1c1917"].includes(readableInk(t.color)), t.name);
  }
});

test("colorsForTags: tra màu theo tên, không phân biệt kiểu chữ, bỏ tên lạ", () => {
  const palette = mergeTags(undefined);
  assert.deepEqual(colorsForTags(["Hẹn hò"], palette), [palette[0].color]);
  assert.deepEqual(colorsForTags(["hẸn hÒ"], palette), [palette[0].color]);
  assert.deepEqual(colorsForTags(["Không tồn tại"], palette), []);
  assert.equal(colorsForTags(["Hẹn hò", "Ăn uống"], palette).length, 2);
});
