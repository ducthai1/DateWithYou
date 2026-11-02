/*
 * What the "Thêm dự định" form fills in on its own.
 *
 * The guesses are shown preselected, so a wrong one is a wrong answer the user
 * has to notice and undo — the cases below are the titles that read as two
 * kinds at once, and the place names that fold into ordinary words.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATEGORIES, PLAN_IDEAS, guessPlanCategory, pickIdeas, planFromPlace } from "@/lib/plan-ideas";

describe("guessing the kind from a title", () => {
  test("every built-in idea guesses back to its own kind", () => {
    for (const idea of PLAN_IDEAS) {
      assert.equal(guessPlanCategory(idea.title), idea.category, idea.title);
    }
  });

  const cases: Array<[string, string | null]> = [
    ["Đi ăn lẩu", "Ăn uống"],
    ["Đi Hội An", "Du lịch"],
    ["Nha Trang 3 ngày", "Du lịch"],
    ["Mua nhà", "Tổ ấm"],
    ["Mua xe máy mới", "Mua sắm"],
    ["Đi Nhật", "Du lịch"],
    ["Tổ chức sinh nhật cho em", "Trải nghiệm"],
    ["Đi xem phim", "Trải nghiệm"],
    ["Leo núi Fansipan", "Du lịch"],
    ["Học lái ô tô", "Học cùng nhau"],
    ["ĐI   ĐÀ   LẠT", "Du lịch"],
    ["", null],
    ["   ", null],
    ["Một điều bí mật", null],
    ["👩‍❤️‍👨", null],
  ];
  for (const [title, kind] of cases) {
    test(`"${title}" → ${kind ?? "không đoán"}`, () => {
      assert.equal(guessPlanCategory(title), kind);
    });
  }

  test("the guess is always one of the fixed kinds", () => {
    for (const idea of PLAN_IDEAS) {
      const g = guessPlanCategory(idea.title);
      assert.ok(g === null || (PLAN_CATEGORIES as readonly string[]).includes(g));
    }
  });
});

describe("which ideas are offered", () => {
  test("the first page covers every kind", () => {
    const kinds = new Set(pickIdeas({ taken: [] }).map((i) => i.category));
    assert.equal(kinds.size, PLAN_CATEGORIES.length);
  });

  test("one already on the board is not offered, whatever its accents or case", () => {
    const offered = pickIdeas({ taken: ["di da lat", "  ĂN BUFFET HẢI SẢN "], count: 100 });
    assert.ok(!offered.some((i) => i.title === "Đi Đà Lạt"));
    assert.ok(!offered.some((i) => i.title === "Ăn buffet hải sản"));
    assert.equal(offered.length, PLAN_IDEAS.length - 2);
  });

  test("a chosen kind narrows the list to that kind", () => {
    const offered = pickIdeas({ taken: [], category: "Tổ ấm", count: 100 });
    assert.ok(offered.length > 0);
    assert.ok(offered.every((i) => i.category === "Tổ ấm"));
  });

  test("what is typed narrows it, without accents", () => {
    const offered = pickIdeas({ taken: [], typed: "da lat" });
    assert.deepEqual(offered.map((i) => i.title), ["Đi Đà Lạt"]);
    assert.deepEqual(pickIdeas({ taken: [], typed: "không có ý nào như vầy" }), []);
  });

  test("'Ý khác' walks through the rest without repeating within a page", () => {
    const seen = new Set<string>();
    const pages = Math.ceil(PLAN_IDEAS.length / 6);
    for (let turn = 0; turn < pages; turn++) {
      const page = pickIdeas({ taken: [], turn });
      assert.equal(new Set(page.map((i) => i.title)).size, page.length);
      page.forEach((i) => seen.add(i.title));
    }
    assert.equal(seen.size, PLAN_IDEAS.length, "every idea shows up within one cycle");
  });

  test("an unknown kind (one typed before the fixed list) offers nothing rather than everything", () => {
    assert.deepEqual(pickIdeas({ taken: [], category: "cùng nhau" }), []);
  });
});

describe("a saved place as a plan", () => {
  test("a café is food, with where it is and what to order", () => {
    assert.deepEqual(
      planFromPlace({ name: "Okkio Caffe", category: "Cà phê", district: "Phường Sài Gòn", mustTry: "Cold brew cam" }),
      { title: "Okkio Caffe", category: "Ăn uống", description: "Ở Phường Sài Gòn. Món nên thử: Cold brew cam." },
    );
  });

  test("a category the space made up is guessed from its name", () => {
    assert.equal(planFromPlace({ name: "Quán A", category: "Lẩu nướng" }).category, "Ăn uống");
    assert.equal(planFromPlace({ name: "Chỗ lạ", category: "Bí mật" }).category, "Trải nghiệm");
  });

  test("nothing to say leaves the note empty", () => {
    assert.equal(planFromPlace({ name: "X", category: "Khác", district: null, mustTry: "" }).description, "");
  });
});
