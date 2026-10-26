import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { landscapeBox } from "@/lib/player-landscape";

/*
 * Xoay ngang trình phát: hộp mà khung phát lấp đầy.
 *
 * Màn dọc thì hộp rộng bằng chiều CAO màn, cao bằng chiều RỘNG màn, xoay 90°
 * quanh góc trên-trái rồi đẩy sang phải đúng một bề rộng màn — phải phủ khít,
 * không thừa không thiếu một px, không thì lộ trang phía sau ở một mép.
 */

/** Where the box's corners land: rotate 90° about (0,0), then shift right. */
function corners(b: ReturnType<typeof landscapeBox>) {
  const rot = ([x, y]: [number, number]): [number, number] => (b.rotated ? [-y + b.shiftX, x] : [x, y]);
  return [rot([0, 0]), rot([b.width, 0]), rot([0, b.height]), rot([b.width, b.height])];
}

describe("màn dọc", () => {
  for (const [vw, vh] of [
    [390, 844],
    [375, 667],
    [430, 932],
  ]) {
    test(`${vw}×${vh}: xoay và phủ khít đúng cả màn`, () => {
      const b = landscapeBox(vw, vh);
      assert.equal(b.rotated, true);
      assert.deepEqual([b.width, b.height], [vh, vw], "hộp nằm ngang: dài theo chiều cao màn");
      const xs = corners(b).map((c) => c[0]);
      const ys = corners(b).map((c) => c[1]);
      assert.deepEqual([Math.min(...xs), Math.max(...xs)], [0, vw]);
      assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, vh]);
    });
  }
});

describe("màn đã nằm ngang (khoá được, hoặc máy đang nằm ngang)", () => {
  test("không xoay thêm, phủ đúng cả màn", () => {
    assert.deepEqual(landscapeBox(844, 390), { width: 844, height: 390, rotated: false, shiftX: 0 });
  });
  test("màn vuông không xoay", () => {
    assert.equal(landscapeBox(800, 800).rotated, false);
  });
});
