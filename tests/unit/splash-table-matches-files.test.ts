import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

/*
 * Bảng ảnh khởi động ↔ thư mục ảnh ↔ số pixel thật: ba thứ phải khớp.
 *
 * iOS chỉ hiện ảnh khởi động khi `<link>` khớp **đúng** kích thước và dpr của
 * máy; lệch một pixel là nó bỏ qua và không báo gì. Nên mọi sai ở đây đều câm,
 * và "máy này chưa được hỗ trợ" trông y hệt "chúng ta gõ sai một con số".
 *
 * Bảng và ảnh vốn là hai thứ viết tay ở hai commit khác nhau — bảng sửa lần
 * cuối ở một commit, ảnh dựng lại ở commit sau. Bài này là thứ duy nhất buộc
 * chúng đi cùng nhau.
 */
const ROOT = new URL("../..", import.meta.url).pathname;
const SRC = `${ROOT}/src/components/layout/apple-splash-links.tsx`;
const DIR = `${ROOT}/public/splash`;

type Row = { w: number; h: number; dpr: number; orient: string; file: string };

function table(): Row[] {
  const src = readFileSync(SRC, "utf8");
  return [...src.matchAll(
    /\{\s*w:\s*(\d+),\s*h:\s*(\d+),\s*dpr:\s*(\d+),\s*orient:\s*"(portrait|landscape)",\s*file:\s*"([^"]+)"/g,
  )].map((m) => ({ w: +m[1], h: +m[2], dpr: +m[3], orient: m[4], file: m[5] }));
}

/** Kích thước thật đọc thẳng từ IHDR — 16 byte đầu là đủ. */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  assert.equal(b.readUInt32BE(0), 0x89504e47, `${path} không phải PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("ảnh khởi động iOS", () => {
  const rows = table();

  test("đọc được bảng", () => {
    assert.ok(rows.length >= 24, `chỉ đọc được ${rows.length} dòng — cấu trúc component đã đổi?`);
  });

  test("mỗi dòng có một file, đúng số pixel vật lý", () => {
    for (const r of rows) {
      const path = `${DIR}/${r.file}`;
      assert.ok(existsSync(path), `thiếu ${r.file} — bảng khai mà không có ảnh`);
      const want = r.orient === "landscape"
        ? { w: r.h * r.dpr, h: r.w * r.dpr }
        : { w: r.w * r.dpr, h: r.h * r.dpr };
      assert.deepEqual(pngSize(path), want, `${r.file} sai kích thước`);
    }
  });

  test("không có ảnh nào thừa trong thư mục", () => {
    const declared = new Set(rows.map((r) => r.file));
    const extra = readdirSync(DIR).filter((f) => f.endsWith(".png") && !declared.has(f));
    assert.deepEqual(extra, [], `ảnh không có dòng nào trỏ tới — sẽ không bao giờ hiện: ${extra.join(", ")}`);
  });

  test("không dòng nào trùng bộ (kích thước, dpr, hướng)", () => {
    // Trùng thì iOS lấy cái CUỐI, nên một dòng sửa đúng có thể bị dòng cũ che.
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.w}x${r.h}@${r.dpr}-${r.orient}`;
      assert.ok(!seen.has(key), `hai dòng cùng ${key} — cái sau che cái trước`);
      seen.add(key);
    }
  });
});
