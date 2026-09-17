import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { trailPaint } from "@/lib/route-trail";

/*
 * Xoá phần đường đã đi bằng `line-gradient`.
 *
 * Lý do đáng test một hàm nhỏ thế này: MapLibre **ném lỗi** khi các mốc của
 * `interpolate` không tăng dần nghiêm ngặt — và một lỗi ném ra lúc vẽ thì
 * không phải "đường hơi sai", mà là **bản đồ trắng giữa lúc đang chạy xe**.
 * Ba chỗ hẹp là 0, 1 và ngay sát 1.
 */

const stops = (paint: Record<string, unknown>) => {
  const g = paint["line-gradient"] as unknown[] | undefined;
  if (!g) return null;
  // ["interpolate", ["linear"], ["line-progress"], s0, c0, s1, c1, …]
  return g.slice(3).filter((_, i) => i % 2 === 0) as number[];
};

describe("khi chưa biết đi được bao xa thì vẽ nguyên tuyến", () => {
  for (const [label, v] of [
    ["chưa chạy", null], ["undefined", undefined], ["NaN", NaN],
    ["âm", -0.2], ["vừa xuất phát", 0], ["đã tới nơi", 1],
  ] as Array<[string, number | null | undefined]>) {
    test(label, () => {
      const paint = trailPaint(v, "#3b82f6", 1);
      assert.equal(paint["line-color"], "#3b82f6");
      assert.equal(paint["line-gradient"], undefined, "không được sinh gradient ở ca này");
    });
  }
});

describe("khi đang đi thì mốc phải TĂNG DẦN NGHIÊM NGẶT", () => {
  test("giữa đường", () => {
    const s = stops(trailPaint(0.5, "#3b82f6", 1));
    assert.deepEqual(s, [0, 0.5, 0.502, 1]);
  });

  test("sát đích — mốc vẫn không được chạm hoặc vượt 1", () => {
    /*
     * 0.998 + 0.002 = 1.000, bằng mốc cuối ⇒ hai mốc trùng nhau ⇒ MapLibre ném.
     * Đây là ca xảy ra ở đúng những mét cuối của mỗi chuyến, tức là thường
     * xuyên chứ không hiếm.
     */
    const s = stops(trailPaint(0.998, "#3b82f6", 1))!;
    assert.ok(s, "phải có gradient ở 0.998");
    for (let i = 1; i < s.length; i++) {
      assert.ok(s[i] > s[i - 1], `mốc ${i} (${s[i]}) không lớn hơn mốc trước (${s[i - 1]})`);
    }
    assert.ok(s[s.length - 1] <= 1, "mốc cuối vượt quá 1");
  });

  test("mọi giá trị trong khoảng đều cho mốc hợp lệ", () => {
    // Quét thay vì chọn vài điểm: chỗ hỏng nằm ở rìa, và rìa thì dễ đoán trượt.
    for (let f = 0.002; f < 0.999; f += 0.001) {
      const s = stops(trailPaint(f, "#3b82f6", 1));
      if (!s) continue;
      for (let i = 1; i < s.length; i++) {
        assert.ok(s[i] > s[i - 1], `f=${f.toFixed(3)}: mốc ${i} (${s[i]}) <= ${s[i - 1]}`);
      }
    }
  });

  test("phần phía sau trong suốt, phần phía trước giữ màu", () => {
    // ["interpolate", ["linear"], ["line-progress"], 0,c, f,c, f+δ,c, 1,c]
    //   chỉ số:        0            1           2      3 4  5 6  7   8  9 10
    const g = trailPaint(0.4, "#3b82f6", 1)["line-gradient"] as unknown[];
    assert.equal(g[4], "rgba(0,0,0,0)", "mốc 0 phải trong suốt");
    assert.equal(g[6], "rgba(0,0,0,0)", "ngay trước vị trí hiện tại vẫn trong suốt");
    assert.equal(g[8], "#3b82f6", "ngay sau vị trí hiện tại phải có màu");
    assert.equal(g[10], "#3b82f6", "tới cuối tuyến vẫn giữ màu");
  });

  test("vỏ ngoài giữ độ mờ riêng của nó", () => {
    assert.equal(trailPaint(0.4, "#1e3a8a", 0.9)["line-opacity"], 0.9);
  });
});
