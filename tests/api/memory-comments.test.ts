/*
 * Bình luận dưới một kỷ niệm.
 *
 * Bốn luật dễ sai và khi sai thì không nhìn thấy được:
 *
 *   - kỷ niệm của cặp khác phải bị TỪ CHỐI, cả khi đọc lẫn khi viết. Không có
 *     gì khác chặn một client gắn bình luận vào kỷ niệm của người lạ.
 *   - xoá được bình luận của CHÍNH MÌNH thôi. Hai người cùng đọc được cả
 *     thread, nên "tôi thấy được" không được phép thành "tôi xoá được" —
 *     và không có lịch sử nào để ai đó nhận ra một dòng đã biến mất.
 *   - thứ tự đọc là thứ tự viết. Một thread đảo lộn thì không còn là hội thoại.
 *   - xoá không gian phải cuốn theo bình luận. Đây là collection mới nhất, tức
 *     là cái dễ bị bỏ quên nhất trong danh sách cascade.
 *
 * Và id sai định dạng phải ra lỗi từ schema, không phải CastError của Mongoose
 * nổi lên thành 500.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, must, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;
let memoryId: string;
let theirMemoryId: string;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Bình" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
  memoryId = (await couple.a.caller.memory.create({ title: "Đi biển", date: new Date("2026-05-01") })).id;
  theirMemoryId = (await outsider.caller.memory.create({ title: "Của người khác", date: new Date("2026-05-02") })).id;
});

after(closeDatabase);

describe("viết và đọc", () => {
  test("viết được, và cả hai người cùng đọc thấy", async () => {
    await couple.a.caller.memory.addComment({ memoryId, text: "Hôm đó vui thật" });
    const seenByB = await couple.b.caller.memory.comments({ memoryId });
    assert.equal(seenByB.length, 1);
    assert.equal(seenByB[0].text, "Hôm đó vui thật");
    assert.equal(seenByB[0].authorId, couple.a.userId);
  });

  test("đọc theo đúng thứ tự viết", async () => {
    await couple.b.caller.memory.addComment({ memoryId, text: "Ừ, đi lại nhé" });
    await couple.a.caller.memory.addComment({ memoryId, text: "Chốt" });
    const rows = await couple.a.caller.memory.comments({ memoryId });
    assert.deepEqual(rows.map((r) => r.text), ["Hôm đó vui thật", "Ừ, đi lại nhé", "Chốt"]);
  });

  test("bình luận rỗng hoặc chỉ khoảng trắng thì không nhận", async () => {
    await rejects(() => couple.a.caller.memory.addComment({ memoryId, text: "   " }), "BAD_REQUEST");
  });

  test("dài quá mức thì chặn ở schema, không cắt bớt im lặng", async () => {
    await rejects(
      () => couple.a.caller.memory.addComment({ memoryId, text: "a".repeat(501) }),
      "BAD_REQUEST",
    );
  });
});

describe("ranh giới giữa hai cặp", () => {
  test("không đọc được thread của cặp khác", async () => {
    await rejects(() => couple.a.caller.memory.comments({ memoryId: theirMemoryId }), "NOT_FOUND");
  });

  test("không viết được vào kỷ niệm của cặp khác", async () => {
    await rejects(
      () => couple.a.caller.memory.addComment({ memoryId: theirMemoryId, text: "xin chào" }),
      "NOT_FOUND",
    );
  });

  test("id bịa ra cũng là NOT_FOUND, không phải lỗi máy chủ", async () => {
    await rejects(
      () => couple.a.caller.memory.comments({ memoryId: "60f000000000000000000000" }),
      "NOT_FOUND",
    );
  });
});

describe("xoá", () => {
  test("xoá được dòng của chính mình", async () => {
    const { id } = await couple.a.caller.memory.addComment({ memoryId, text: "nhầm" });
    await must(couple.a.caller.memory.deleteComment({ id }));
    const rows = await couple.a.caller.memory.comments({ memoryId });
    assert.ok(!rows.some((r) => r.id === id), "dòng vừa xoá vẫn còn");
  });

  test("KHÔNG xoá được dòng của người kia", async () => {
    // Cùng không gian, cùng đọc được — nhưng không được phép xoá.
    const { id } = await couple.a.caller.memory.addComment({ memoryId, text: "của An" });
    await rejects(() => couple.b.caller.memory.deleteComment({ id }), "NOT_FOUND");
    const rows = await couple.b.caller.memory.comments({ memoryId });
    assert.ok(rows.some((r) => r.id === id), "dòng của người kia đã bị xoá mất");
  });
});

describe("xoá không gian thì cuốn theo bình luận", () => {
  test("không còn dòng nào sót lại", async () => {
    const solo = await makeMember({ name: "Dũng", spaceName: "Góc của Dũng" });
    const mid = (await solo.caller.memory.create({ title: "Một hôm", date: new Date("2026-06-01") })).id;
    await solo.caller.memory.addComment({ memoryId: mid, text: "để lại xem có bị xoá không" });

    const { MemoryCommentModel } = await import("../../src/server/db/models/memory-comment.ts");
    assert.equal(await MemoryCommentModel.countDocuments({ spaceId: solo.spaceId }), 1);

    const { deleteSpaceAndData } = await import("../../src/server/db/delete-space-cascade.ts");
    await deleteSpaceAndData(solo.spaceId);

    assert.equal(
      await MemoryCommentModel.countDocuments({ spaceId: solo.spaceId }),
      0,
      "bình luận còn nằm lại sau khi không gian đã bị xoá",
    );
  });
});
