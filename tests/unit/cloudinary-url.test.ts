import { test } from "node:test";
import assert from "node:assert/strict";
import { cldFull, cldPreview, cldThumb, cldThumbSrcSet } from "../../src/lib/cloudinary-url.ts";

/*
 * Sizes must be asked for in pixels, never left to a client hint.
 *
 * `dpr_auto` answers the browser's DPR hint, which no page here sends, so it
 * resolved to 1 every time and every thumbnail in the app was a 1x image
 * stretched over a 2x or 3x box. Measured on one asset: 8,846 bytes with no
 * hint against 42,615 with `DPR: 3`. These tests exist to keep it out.
 */

const SRC = "https://res.cloudinary.com/demo/image/upload/v1/folder/sample.jpg";

test("cldThumb: cắt vuông đúng kích thước, và KHÔNG có dpr_auto", () => {
  const u = cldThumb(SRC, 256);
  assert.match(u, /\/image\/upload\/c_fill,g_auto,w_256,h_256,f_auto,q_auto\//);
  assert.doesNotMatch(u, /dpr_auto/);
  assert.ok(u.endsWith("/v1/folder/sample.jpg"), u);
});

test("cldPreview và cldFull: giới hạn cạnh, cũng không dpr_auto", () => {
  assert.match(cldPreview(SRC, 1000), /c_limit,w_1000,f_auto,q_auto/);
  assert.doesNotMatch(cldPreview(SRC), /dpr_auto/);
  assert.match(cldFull(SRC, 2000), /c_limit,w_2000,f_auto,q_auto/);
  assert.doesNotMatch(cldFull(SRC), /dpr_auto/);
});

test("Không phải Cloudinary thì trả nguyên vẹn", () => {
  const other = "https://example.com/a.jpg";
  assert.equal(cldThumb(other, 200), other);
  assert.equal(cldPreview(other), other);
  assert.equal(cldThumbSrcSet(other, [160, 320]), "");
});

test("URL đã mang sẵn phép biến đổi thì không chồng thêm phép nữa", () => {
  const already = "https://res.cloudinary.com/demo/image/upload/c_fill,w_100,h_100/sample.jpg";
  assert.equal(cldThumb(already, 400), already);
});

test("cldThumbSrcSet: mỗi ứng viên kèm mô tả bề rộng, đúng thứ tự", () => {
  const set = cldThumbSrcSet(SRC, [160, 256, 384]);
  const parts = set.split(", ");
  assert.equal(parts.length, 3, set);
  parts.forEach((p, i) => {
    const w = [160, 256, 384][i];
    assert.ok(p.endsWith(` ${w}w`), p);
    assert.match(p, new RegExp(`w_${w},h_${w}`), p);
  });
});
