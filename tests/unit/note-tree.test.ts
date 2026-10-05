import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNoteTree,
  countNotes,
  replyParentId,
  MAX_DEPTH,
  type FlatNote,
} from "@/features/interactions/note-tree";

const at = (s: number) => new Date(2026, 9, 5, 10, 0, s).toISOString();
const n = (id: string, parentId: string | null, sec: number): FlatNote => ({
  id,
  parentId,
  createdAt: at(sec),
});

test("danh sách phẳng thành cây, cũ nhất trước ở mọi cấp", () => {
  const tree = buildNoteTree([
    n("a", null, 1),
    n("b", null, 3),
    n("a2", "a", 4),
    n("a1", "a", 2),
    n("a1x", "a1", 5),
  ]);
  assert.deepEqual(tree.map((x) => x.id), ["a", "b"]);
  assert.deepEqual(tree[0].children.map((x) => x.id), ["a1", "a2"]);
  assert.deepEqual(tree[0].children[0].children.map((x) => x.id), ["a1x"]);
  assert.deepEqual([tree[0].depth, tree[0].children[0].depth, tree[0].children[0].children[0].depth], [1, 2, 3]);
});

test("con đứng TRƯỚC cha trong danh sách vẫn ra đúng độ sâu", () => {
  /*
   * Máy chủ sắp theo `createdAt`, nhưng không có gì hứa cha luôn đứng trước
   * con sau khi lọc hay gộp nhiều lô. Tính độ sâu dọc đường thì ca này ra sai
   * và không bao giờ được sửa lại.
   */
  const tree = buildNoteTree([n("con", "cha", 9), n("cha", null, 1)]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "cha");
  assert.equal(tree[0].children[0].depth, 2);
});

test("bình luận mồ côi được nâng lên làm gốc, không biến mất", () => {
  // Cha đã bị xoá nhưng client còn giữ con trong bộ nhớ tới lần làm mới sau.
  const tree = buildNoteTree([n("mo-coi", "da-xoa", 2), n("that", null, 1)]);
  assert.deepEqual(tree.map((x) => x.id), ["that", "mo-coi"]);
  assert.equal(countNotes(tree), 2);
});

test("tự làm cha của chính mình thì không treo máy", () => {
  const tree = buildNoteTree([n("x", "x", 1)]);
  assert.deepEqual(tree.map((t) => t.id), ["x"]);
  assert.equal(countNotes(tree), 1);
});

test("đếm cả cây, không chỉ đếm gốc", () => {
  const tree = buildNoteTree([n("a", null, 1), n("a1", "a", 2), n("a1x", "a1", 3), n("b", null, 4)]);
  assert.equal(tree.length, 2);
  assert.equal(countNotes(tree), 4);
});

test("trả lời ở cấp sâu nhất thì treo ngang hàng, không sâu thêm", () => {
  const tree = buildNoteTree([n("a", null, 1), n("a1", "a", 2), n("a1x", "a1", 3)]);
  const root = tree[0];
  const mid = root.children[0];
  const deep = mid.children[0];
  assert.equal(deep.depth, MAX_DEPTH);
  assert.equal(replyParentId(root), "a");
  assert.equal(replyParentId(mid), "a1");
  // Đây là điểm chính: trả lời cấp 3 KHÔNG tạo cấp 4 — nó treo vào cha của nó.
  assert.equal(replyParentId(deep), "a1");
});
