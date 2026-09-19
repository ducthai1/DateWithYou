import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { trailPaint } from "@/lib/route-trail";

/*
 * Xoá phần đường đã đi bằng `line-gradient`.
 *
 * Lý do đáng test một hàm nhỏ thế này: biểu thức ở đây quyết định MapLibre vẽ
 * chỗ cắt sắc hay nhoè, và cái đó không nhìn thấy trong bất kỳ kiểu kiểm tra
 * DOM nào — chỉ ảnh chụp mới thấy (bộ e2e `trail`). Còn ở đây giữ lấy quyết
 * định, kèm lý do, để đừng ai đổi ngược lại vì "gradient mượt hơn".
 */

/** ["step", ["line-progress"], c0, s1, c1] */
const g = (paint: Record<string, unknown>) => paint["line-gradient"] as unknown[] | undefined;

describe("khi chưa biết đi được bao xa thì vẽ nguyên tuyến", () => {
  for (const [label, v] of [
    ["chưa chạy", null], ["undefined", undefined], ["NaN", NaN],
    ["âm", -0.2], ["vừa xuất phát", 0], ["đã tới nơi", 1],
  ] as Array<[string, number | null | undefined]>) {
    test(label, () => {
      const paint = trailPaint(v, "#3b82f6", 1);
      assert.equal(paint["line-color"], "#3b82f6");
      assert.equal(g(paint), undefined, "không được sinh gradient ở ca này");
    });
  }
});

describe("khi đang đi thì cắt bằng STEP, không phải interpolate", () => {
  /*
   * Đây là chỗ dễ bị đảo nhất, nên nói rõ vì sao.
   *
   * MapLibre nướng `line-gradient` thành một ảnh 1 chiều. Với `interpolate`,
   * ảnh ấy **luôn 256 texel cho cả tuyến** và lấy mẫu LINEAR; tuyến 11.6km ⇒
   * một texel 45m ⇒ ở mức phóng lúc đang đi là hơn 100px, nên chỗ cắt là một
   * vệt nhạt dài chứ không phải một cạnh. Với `step`, cùng hàm đó nâng độ phân
   * giải theo chiều dài tuyến và lấy mẫu NEAREST. Đo bằng ảnh chụp: màu ngay
   * trước mũi xe là (59,130,246) đúng màu tuyến với `step`, còn `interpolate`
   * cho (119,129,147) — đã bạc gần hết.
   */
  test("dùng step, và chỉ có đúng một mốc", () => {
    const expr = g(trailPaint(0.4, "#3b82f6", 1))!;
    assert.equal(expr[0], "step", "đổi sang interpolate là chỗ cắt nhoè lại");
    assert.deepEqual(expr[1], ["line-progress"]);
    assert.equal(expr.length, 5, "đúng một mốc: trong suốt → màu");
  });

  test("phía sau trong suốt, phía trước giữ màu, mốc đặt đúng chỗ người đi", () => {
    const expr = g(trailPaint(0.4, "#3b82f6", 1))!;
    assert.equal(expr[2], "rgba(0,0,0,0)", "đoạn đã đi phải trong suốt");
    assert.equal(expr[3], 0.4, "mốc phải đúng bằng phần đã đi");
    assert.equal(expr[4], "#3b82f6", "đoạn còn lại giữ màu");
  });

  test("mọi giá trị trong khoảng đều cho mốc nằm hẳn trong tuyến", () => {
    // Quét thay vì chọn vài điểm: chỗ hỏng nằm ở rìa, và rìa thì dễ đoán trượt.
    for (let f = 0.002; f < 0.999; f += 0.001) {
      const expr = g(trailPaint(f, "#3b82f6", 1));
      if (!expr) continue;
      const stop = expr[3] as number;
      assert.ok(stop > 0 && stop < 1, `f=${f.toFixed(3)}: mốc ${stop} ra ngoài tuyến`);
    }
  });

  test("vỏ ngoài giữ độ mờ riêng của nó", () => {
    assert.equal(trailPaint(0.4, "#1e3a8a", 0.9)["line-opacity"], 0.9);
  });
});
