import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PHOTOS_PER_MEMORY,
  MAX_PHOTO_CAPTION,
  UPLOAD_CONCURRENCY,
} from "@/lib/memory-limits";

/*
 * Numbers the UI, the upload queue and the server validator all read from one
 * place. They are asserted here so a change is a deliberate edit to a test and
 * not a quiet drift that lets the client offer more than the server accepts.
 */

test("giới hạn ảnh mỗi kỷ niệm là 30, đúng con số blog đã hứa với người dùng", () => {
  assert.equal(MAX_PHOTOS_PER_MEMORY, 30);
});

test("các hằng số còn lại nằm trong khoảng hợp lý", () => {
  assert.equal(MAX_PHOTO_CAPTION, 300);
  assert.ok(UPLOAD_CONCURRENCY >= 1 && UPLOAD_CONCURRENCY <= 6, String(UPLOAD_CONCURRENCY));
  for (const n of [MAX_PHOTOS_PER_MEMORY, MAX_PHOTO_CAPTION, UPLOAD_CONCURRENCY]) {
    assert.ok(Number.isInteger(n) && n > 0, String(n));
  }
});
