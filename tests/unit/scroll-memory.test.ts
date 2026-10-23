import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseSavedScroll, scrollToRestore } from "@/lib/scroll-memory";

/*
 * Trình duyệt tự nhớ vị trí cuộn của CỬA SỔ khi reload, nhưng không màn nào ở
 * đây cuộn cửa sổ: PageShell bọc mỗi màn trong một hộp cuộn riêng, nên reload
 * nào cũng về đầu trang. ScrollMemory lưu vị trí lúc rời trang; đây là phần
 * quyết định có trả lại hay không.
 */

const saved = { href: "/library?tab=recipe", top: 840 };

describe("chỉ trả lại khi reload ĐÚNG địa chỉ đó", () => {
  test("reload cùng địa chỉ: về đúng chỗ cũ", () => {
    assert.equal(scrollToRestore(saved, "/library?tab=recipe", "reload"), 840);
  });

  test("vào bằng link, nav, gõ URL hay nút lùi/tới: bắt đầu từ đầu", () => {
    for (const nav of ["navigate", "back_forward", "prerender", undefined]) {
      assert.equal(scrollToRestore(saved, "/library?tab=recipe", nav), null, String(nav));
    }
  });

  test("vị trí lưu từ trang khác, hay cùng trang khác tab, không áp vào đây", () => {
    assert.equal(scrollToRestore(saved, "/library", "reload"), null);
    assert.equal(scrollToRestore(saved, "/calendar", "reload"), null);
  });

  test("đang ở đầu trang thì không cần làm gì", () => {
    assert.equal(scrollToRestore({ href: "/home", top: 0 }, "/home", "reload"), null);
  });
});

describe("dữ liệu lưu hỏng thì coi như không có", () => {
  test("đọc lại đúng thứ đã ghi", () => {
    assert.deepEqual(parseSavedScroll(JSON.stringify(saved)), saved);
  });

  for (const [label, raw] of [
    ["trống", null],
    ["không phải JSON", "{oops"],
    ["thiếu href", JSON.stringify({ top: 10 })],
    ["top là chữ", JSON.stringify({ href: "/home", top: "10" })],
    ["top vô cực", '{"href":"/home","top":1e999}'],
  ] as Array<[string, string | null]>) {
    test(label, () => assert.equal(parseSavedScroll(raw), null));
  }
});
