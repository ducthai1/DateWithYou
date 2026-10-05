/*
 * Bình luận có PHÂN CẤP, và độ sâu do máy chủ quyết.
 *
 * Trước đây mô hình cố ý phẳng — model ghi hẳn "there never should be" — với
 * lý do một không gian chỉ có hai người nên trả lời chẳng để phân biệt với ai.
 * Chủ repo chốt ngược lại 05/10/2026. Giao diện có chặn ở nút bấm, nhưng một
 * lời gọi thẳng vào API vẫn lồng được vô hạn, nên luật thật phải nằm ở đây.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { NOTE_MAX_DEPTH } from "@/server/db/models/note";
import { freshDatabase, closeDatabase, makeCouple } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let memoryId: string;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Bình" });
  memoryId = (
    await couple.a.caller.memory.create({ title: "Đi biển", date: new Date("2026-05-01") })
  ).id;
});

after(closeDatabase);

/** `addNote` trả `{ targetId, note }` — trả thẳng `note` cho gọn chỗ dùng. */
const say = async (body: string, parentId?: string | null) =>
  (await couple.a.caller.interaction.addNote({
    targetType: "memory",
    targetId: memoryId,
    body,
    parentId,
  })).note;

const all = async () => {
  const out = await couple.a.caller.interaction.forTargets({
    targetType: "memory",
    targetIds: [memoryId],
  });
  return out[memoryId].notes;
};

/** Độ sâu thật, đếm bằng cách đi ngược lên theo `parentId`. */
function depthOf(notes: { id: string; parentId: string | null }[], id: string): number {
  let d = 1;
  let cur = notes.find((n) => n.id === id);
  while (cur?.parentId) {
    d++;
    cur = notes.find((n) => n.id === cur!.parentId);
    if (d > 10) throw new Error("vòng lặp cha-con");
  }
  return d;
}

describe("bình luận phân cấp", () => {
  test("gốc, trả lời, trả lời của trả lời — đúng 3 cấp", async () => {
    const a = await say("gốc");
    const b = await say("trả lời", a.id);
    const c = await say("trả lời của trả lời", b.id);
    const notes = await all();
    assert.equal(depthOf(notes, a.id), 1);
    assert.equal(depthOf(notes, b.id), 2);
    assert.equal(depthOf(notes, c.id), 3);
  });

  test("trả lời cấp sâu nhất KHÔNG tạo cấp 4 — nó treo ngang hàng", async () => {
    const a = await say("g2");
    const b = await say("t2", a.id);
    const c = await say("tt2", b.id);
    const d = await say("vượt rào", c.id);
    const notes = await all();
    assert.equal(depthOf(notes, c.id), NOTE_MAX_DEPTH);
    assert.equal(
      depthOf(notes, d.id),
      NOTE_MAX_DEPTH,
      "bình luận thứ tư phải dừng ở cấp sâu nhất",
    );
    // Và nó phải nằm cạnh c, tức cùng cha — không văng lên gốc.
    const got = notes.find((n) => n.id === d.id);
    const cRow = notes.find((n) => n.id === c.id);
    assert.equal(got?.parentId, cRow?.parentId);
  });

  test("lồng nhiều lần nữa vẫn không sâu thêm được", async () => {
    let parent = (await say("đáy")).id;
    const ids: string[] = [parent];
    for (let i = 0; i < 6; i++) {
      parent = (await say(`lồng ${i}`, parent)).id;
      ids.push(parent);
    }
    const notes = await all();
    const deepest = Math.max(...ids.map((id) => depthOf(notes, id)));
    assert.equal(deepest, NOTE_MAX_DEPTH, `sâu nhất đo được ${deepest}`);
  });

  test("cha của kỷ niệm KHÁC thì coi như bình luận gốc, không rò sang nhánh lạ", async () => {
    const other = (
      await couple.a.caller.memory.create({ title: "Kỷ niệm khác", date: new Date("2026-05-02") })
    ).id;
    const outside = (
      await couple.a.caller.interaction.addNote({
        targetType: "memory",
        targetId: other,
        body: "ở nơi khác",
      })
    ).note;
    const sneaky = await say("mượn cha ở kỷ niệm khác", outside.id);
    const notes = await all();
    assert.equal(notes.find((n) => n.id === sneaky.id)?.parentId, null);
  });

  test("xoá một bình luận cuốn theo cả nhánh con", async () => {
    const a = await say("sắp xoá");
    const b = await say("con", a.id);
    const c = await say("cháu", b.id);
    await couple.a.caller.interaction.removeNote({ id: a.id });
    const notes = await all();
    for (const id of [a.id, b.id, c.id]) {
      assert.equal(notes.find((n) => n.id === id), undefined, `${id} phải biến mất`);
    }
  });

  test("cảm xúc thả được lên chính bình luận, và đi kèm bình luận khi đọc", async () => {
    const a = await say("có cảm xúc");
    await couple.b.caller.interaction.react({ targetType: "note", targetId: a.id, emoji: "❤️" });
    const notes = await all();
    const row = notes.find((n) => n.id === a.id);
    assert.deepEqual(
      row?.reactions.map((r) => r.emoji),
      ["❤️"],
    );
  });

  test("xoá bình luận thì cảm xúc của nó không ở lại thành rác", async () => {
    const a = await say("xoá cả cảm xúc");
    await couple.b.caller.interaction.react({ targetType: "note", targetId: a.id, emoji: "🔥" });
    await couple.a.caller.interaction.removeNote({ id: a.id });
    const { ReactionModel } = await import("@/server/db/models/reaction");
    const left = await ReactionModel.countDocuments({ targetType: "note", targetId: a.id });
    assert.equal(left, 0);
  });
});
