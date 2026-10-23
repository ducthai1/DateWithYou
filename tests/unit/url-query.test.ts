import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  dayParam,
  formatMonthParam,
  parseMonthParam,
  pathOf,
  withQuery,
} from "@/lib/url-query";

/*
 * Trạng thái màn hình (tab, bộ lọc, thẻ đang mở) nằm trên query string để
 * reload không đá người dùng về mặc định — Thư viện từng luôn quay về "Nhạc"
 * dù đang ở "Công thức" có lọc nhãn. Mấy hàm này quyết định URL trông ra sao.
 */

describe("withQuery", () => {
  test("đặt khoá mới, giữ nguyên path, khoá khác và hash", () => {
    assert.equal(withQuery("/library?tag=a#top", { tab: "recipe" }), "/library?tag=a&tab=recipe#top");
  });

  test("giá trị rỗng, null, undefined đều là XOÁ khoá", () => {
    for (const empty of ["", null, undefined]) {
      assert.equal(withQuery("/library?tab=recipe&tag=a", { tag: empty }), "/library?tab=recipe");
    }
  });

  test("xoá hết khoá thì không để lại dấu ? thừa", () => {
    assert.equal(withQuery("/library?tab=recipe", { tab: null }), "/library");
  });

  test("tiếng Việt và khoảng trắng đi qua URL rồi đọc lại được nguyên vẹn", () => {
    const href = withQuery("/library", { tag: "giảm cân" });
    assert.equal(new URL(href, "http://x").searchParams.get("tag"), "giảm cân");
  });

  test("một lần ghi đổi được nhiều khoá — đổi tab là xoá luôn bộ lọc của tab cũ", () => {
    const href = withQuery("/library?tab=recipe&tag=a&source=youtube&q=bun&recipe=1", {
      tab: "game", tag: null, source: null, q: null, recipe: null,
    });
    assert.equal(href, "/library?tab=game");
  });
});

describe("pathOf", () => {
  test("bỏ query và hash", () => {
    assert.equal(pathOf("/library?tab=recipe#x"), "/library");
    assert.equal(pathOf("/calendar#top"), "/calendar");
    assert.equal(pathOf("/map"), "/map");
  });
});

describe("tháng và ngày trên URL", () => {
  test("tháng 1-based, đi một vòng không lệch", () => {
    for (const ym of [{ year: 2026, month: 1 }, { year: 2026, month: 8 }, { year: 2026, month: 12 }]) {
      assert.deepEqual(parseMonthParam(formatMonthParam(ym)), ym);
    }
    // Lỗi cũ của màn Lịch là trừ 1 thành tháng Date; tháng 01 phải là 1, không phải 0.
    assert.deepEqual(parseMonthParam("2026-01"), { year: 2026, month: 1 });
  });

  test("URL bậy thì coi như không có, màn tự về tháng này", () => {
    for (const bad of [null, "", "2026-13", "2026-00", "2026-8", "tháng tám", "2026-08-31"]) {
      assert.equal(parseMonthParam(bad), null, String(bad));
    }
  });

  test("ngày chỉ nhận đúng dạng YYYY-MM-DD", () => {
    assert.equal(dayParam("2026-10-23"), "2026-10-23");
    for (const bad of [null, "", "23/10/2026", "2026-10", "2026-10-23x"]) assert.equal(dayParam(bad), null);
  });
});
