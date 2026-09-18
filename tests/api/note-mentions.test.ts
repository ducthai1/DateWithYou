/*
 * Nhắc tên trong ghi chú dưới kỷ niệm.
 *
 * Ghi chú là luồng trò chuyện DUY NHẤT của một kỷ niệm, và nó nằm ngay trên
 * thẻ ngoài danh sách. Trước đây nó không nhận "@" — nên một hệ bình luận thứ
 * hai đã bị dựng lên trong modal chỉ để có tag, và một kỷ niệm có hai chỗ nói
 * chuyện: người này viết chỗ này, người kia đọc chỗ kia. Bài này ghim rằng
 * người được nhắc thực sự được LƯU, chứ không chỉ hiện đẹp ở màn hình.
 *
 * Ba luật khác dễ sai mà không nhìn thấy được:
 *   - kỷ niệm của cặp khác phải bị từ chối, cả khi đọc lẫn khi viết;
 *   - xoá được dòng của CHÍNH MÌNH thôi;
 *   - danh sách người được nhắc có trần, và trần đó phải chặn từ schema chứ
 *     không phải để mongoose ghi bao nhiêu cũng được.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, must, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;
let memoryId: string;
let theirMemoryId: string;

const forMemo = (id: string) => ({ targetType: "memory" as const, targetIds: [id] });

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Bình" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
  memoryId = (await couple.a.caller.memory.create({ title: "Đi biển", date: new Date("2026-05-01") })).id;
  theirMemoryId = (await outsider.caller.memory.create({ title: "Của người khác", date: new Date("2026-05-02") })).id;
});

after(closeDatabase);

describe("ghi chú mang theo người được nhắc", () => {
  test("viết kèm @ thì người được nhắc được lưu, và người kia đọc thấy", async () => {
    await couple.a.caller.interaction.addNote({
      targetType: "memory",
      targetId: memoryId,
      body: "Đẹp quá @Bình",
      mentions: [couple.b.userId],
    });

    const seenByB = await couple.b.caller.interaction.forTargets(forMemo(memoryId));
    const note = must(seenByB[memoryId]?.notes[0]);
    assert.equal(note.body, "Đẹp quá @Bình");
    assert.deepEqual(note.mentions, [couple.b.userId], "người được nhắc phải đi kèm khi đọc ra");
  });

  test("không nhắc ai thì mảng rỗng, không phải undefined", async () => {
    await couple.b.caller.interaction.addNote({
      targetType: "memory", targetId: memoryId, body: "Ừ, hôm đó nắng đẹp",
    });
    const rows = must((await couple.a.caller.interaction.forTargets(forMemo(memoryId)))[memoryId]).notes;
    const plain = must(rows.find((n) => n.body === "Ừ, hôm đó nắng đẹp"));
    assert.deepEqual(plain.mentions, [], "phải là [] để chỗ đọc không cần đoán");
  });

  test("thứ tự đọc là thứ tự viết", async () => {
    const rows = must((await couple.a.caller.interaction.forTargets(forMemo(memoryId)))[memoryId]).notes;
    assert.deepEqual(rows.map((n) => n.body), ["Đẹp quá @Bình", "Ừ, hôm đó nắng đẹp"]);
  });

  /*
   * Ghi chú cũ — viết trước khi trường này tồn tại — không có `mentions` trong
   * tài liệu. Chỗ đọc phải trả `[]` chứ không được để `undefined` rơi ra client
   * và làm `.map` nổ giữa danh sách.
   */
  test("ghi chú cũ không có trường đó vẫn đọc ra mảng rỗng", async () => {
    const { NoteModel } = await import("../../src/server/db/models/note.ts");
    await NoteModel.collection.insertOne({
      spaceId: couple.a.spaceId, targetType: "memory", targetId: memoryId,
      userId: couple.a.userId, body: "Dòng từ thời chưa có tag",
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
    });
    const rows = must((await couple.a.caller.interaction.forTargets(forMemo(memoryId)))[memoryId]).notes;
    const old = must(rows.find((n) => n.body === "Dòng từ thời chưa có tag"));
    assert.deepEqual(old.mentions, []);
  });
});

describe("ranh giới", () => {
  test("không viết được vào kỷ niệm của cặp khác", async () => {
    await rejects(
      () => couple.a.caller.interaction.addNote({
        targetType: "memory", targetId: theirMemoryId, body: "Chen vào", mentions: [],
      }),
      "NOT_FOUND",
    );
  });

  test("không đọc được ghi chú của cặp khác", async () => {
    const out = await couple.a.caller.interaction.forTargets(forMemo(theirMemoryId));
    assert.equal(out[theirMemoryId], undefined, "id ngoài không gian không được có mặt trong kết quả");
  });

  test("quá số người được nhắc cho phép thì schema chặn", async () => {
    await rejects(
      () => couple.a.caller.interaction.addNote({
        targetType: "memory", targetId: memoryId, body: "@a @b @c @d @e",
        mentions: ["1", "2", "3", "4", "5"],
      }),
      "BAD_REQUEST",
    );
  });

  test("xoá được dòng của chính mình, không xoá được dòng người kia", async () => {
    const rows = must((await couple.a.caller.interaction.forTargets(forMemo(memoryId)))[memoryId]).notes;
    const hers = must(rows.find((n) => n.userId === couple.b.userId));
    // FORBIDDEN chứ không phải NOT_FOUND: dòng đó CÓ thật và mình đọc được nó,
    // chỉ là không phải của mình. Hai mã đó nói hai chuyện khác nhau.
    await rejects(() => couple.a.caller.interaction.removeNote({ id: hers.id }), "FORBIDDEN");

    const mine = must(rows.find((n) => n.userId === couple.a.userId));
    await couple.a.caller.interaction.removeNote({ id: mine.id });
    const after = must((await couple.a.caller.interaction.forTargets(forMemo(memoryId)))[memoryId]).notes;
    assert.ok(!after.some((n) => n.id === mine.id), "dòng của mình đã đi");
    assert.ok(after.some((n) => n.id === hers.id), "dòng của người kia còn nguyên");
  });
});
