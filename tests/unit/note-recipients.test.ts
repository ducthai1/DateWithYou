import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { noteRecipients } from "@/lib/note-recipients";

/*
 * Ai được báo khi có ghi chú mới dưới một kỷ niệm.
 *
 * Sai ở đây thì im lặng: báo cho chính người vừa viết, hoặc rung hai lần vào
 * người vừa bị nhắc tên. Không màn hình nào cho thấy điều đó.
 */
describe("noteRecipients", () => {
  test("người kia được báo, người viết thì không", () => {
    assert.deepEqual(noteRecipients({ members: ["a", "b"], authorId: "a", alreadyNotified: [] }), ["b"]);
  });

  test("ai vừa nhận chuông nhắc tên thì không rung lần hai", () => {
    assert.deepEqual(noteRecipients({ members: ["a", "b"], authorId: "a", alreadyNotified: ["b"] }), []);
  });

  test("một mình trong không gian thì không báo cho ai", () => {
    assert.deepEqual(noteRecipients({ members: ["a"], authorId: "a", alreadyNotified: [] }), []);
  });

  test("id trùng trong danh sách vẫn chỉ nhận một lần", () => {
    assert.deepEqual(noteRecipients({ members: ["a", "b", "b"], authorId: "a", alreadyNotified: [] }), ["b"]);
  });

  test("ba người thì hai người còn lại đều được báo", () => {
    assert.deepEqual(
      noteRecipients({ members: ["a", "b", "c"], authorId: "a", alreadyNotified: [] }),
      ["b", "c"],
    );
  });
});
