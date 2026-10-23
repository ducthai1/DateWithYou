import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { familyOf, stepTrail } from "@/lib/back-trail";

/*
 * Vết đường của tab (đọc bởi nút "quay lại" và SmartBackLink) nay lưu cả query.
 *
 * Trước đây chỉ lưu path, nên thoát khỏi trình phát nhạc là về `/library` trần
 * và Thư viện mở ở tab đầu, không phải tab người ta vừa đứng. Nhưng quyết định
 * "đây có phải một BƯỚC mới không" vẫn phải xét theo path: đổi tab trên cùng
 * một trang là cùng một chỗ với địa chỉ mới, không phải một chỗ mới.
 */

const walk = (hrefs: string[]) => hrefs.reduce<string[]>((t, h) => stepTrail(t, h), []);

describe("cùng trang, query mới: sửa bước hiện tại chứ không thêm bước", () => {
  test("đổi tab Thư viện ba lần vẫn chỉ là một bước, mang query mới nhất", () => {
    assert.deepEqual(
      walk(["/home", "/library", "/library?tab=recipe", "/library?tab=recipe&tag=gi%E1%BA%A3m+c%C3%A2n"]),
      ["/home", "/library?tab=recipe&tag=gi%E1%BA%A3m+c%C3%A2n"],
    );
  });

  test("đi vào trình phát rồi quay lại: bước trước vẫn giữ tab", () => {
    const trail = walk(["/home", "/library?tab=food_video", "/library/phat/abc"]);
    assert.deepEqual(trail, ["/home", "/library?tab=food_video", "/library/phat/abc"]);
    // Nút "thu nhỏ" của trình phát đẩy về đúng bước trước, có query.
    assert.deepEqual(stepTrail(trail, "/library?tab=food_video"), ["/home", "/library?tab=food_video"]);
  });
});

describe("luật cũ vẫn giữ", () => {
  test("là ngăn xếp: quay về bước trước thì bóc bước cuối, không đi vòng A,B,A,B", () => {
    assert.deepEqual(walk(["/home", "/map", "/home"]), ["/home"]);
  });

  test("quay về bước trước bằng địa chỉ khác query vẫn tính là quay về", () => {
    assert.deepEqual(walk(["/library?tab=recipe", "/map", "/library"]), ["/library"]);
  });

  test("các bài trong trình phát là một chỗ: chuyển bài không chôn mất chỗ đã đến", () => {
    assert.deepEqual(walk(["/library", "/library/phat/1", "/library/phat/2", "/library/phat/3"]), [
      "/library",
      "/library/phat/3",
    ]);
    assert.equal(familyOf("/library/phat/3?t=10"), "/library/phat/");
  });

  test("ghé lại đúng chỗ đang đứng thì không đổi gì", () => {
    assert.deepEqual(stepTrail(["/home", "/map"], "/map"), ["/home", "/map"]);
  });

  test("giữ tối đa 12 bước gần nhất", () => {
    const trail = walk(Array.from({ length: 20 }, (_, i) => `/p${i}`));
    assert.equal(trail.length, 12);
    assert.equal(trail[11], "/p19");
  });
});
