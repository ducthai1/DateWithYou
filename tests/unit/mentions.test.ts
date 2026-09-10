import { test } from "node:test";
import assert from "node:assert/strict";
import { appendMention, findMentionRanges, mentionToken } from "@/lib/mentions";

/*
 * Highlighting "@tên" in a note. Two people share a space, so the list is
 * tiny — but names are Vietnamese, may contain spaces, and one person can be
 * addressed by display name or account name. A range off by one character
 * paints the highlight over the wrong letters.
 */

const MEMBERS = [
  { id: "u1", name: "Ngọc Anh", accountName: "ngocanh" },
  { id: "u2", name: "Bình", accountName: null },
];

test("mentionToken và appendMention: chèn đúng khoảng trắng", () => {
  assert.equal(mentionToken("  Bình  "), "@Bình");
  assert.equal(appendMention("", "Bình"), "@Bình ");
  assert.equal(appendMention("chào", "Bình"), "chào @Bình ");
  assert.equal(appendMention("chào ", "Bình"), "chào @Bình ", "đã có khoảng trắng thì không thêm nữa");
});

test("tìm được nhắc tên, kèm vị trí chính xác trong chuỗi", () => {
  const text = "mai @Bình đi nhé";
  const [r] = findMentionRanges(text, MEMBERS);
  assert.equal(r.id, "u2");
  assert.equal(text.slice(r.start, r.end), "@Bình");
});

test("tên có dấu cách vẫn nhận đủ, không dừng ở chữ đầu", () => {
  const text = "gửi @Ngọc Anh nhé";
  const [r] = findMentionRanges(text, MEMBERS);
  assert.equal(r.id, "u1");
  assert.equal(text.slice(r.start, r.end), "@Ngọc Anh");
});

test("gọi bằng tên tài khoản cũng ra đúng người", () => {
  const [r] = findMentionRanges("cảm ơn @ngocanh", MEMBERS);
  assert.equal(r.id, "u1");
  assert.equal(r.name, "Ngọc Anh", "trả về tên hiển thị, không phải tên tài khoản");
});

test("không phân biệt chữ hoa chữ thường", () => {
  assert.equal(findMentionRanges("@BÌNH ơi", MEMBERS).length, 1);
  assert.equal(findMentionRanges("@NGOCANH ơi", MEMBERS).length, 1);
});

test("chữ dính liền phía sau thì không tính là nhắc tên", () => {
  assert.equal(findMentionRanges("@Bìnhh", MEMBERS).length, 0);
  assert.equal(findMentionRanges("@Bình2", MEMBERS).length, 0);
  assert.equal(findMentionRanges("@Bình.", MEMBERS).length, 1, "dấu câu thì vẫn tính");
});

test("nhiều lần nhắc trong một câu, trả về theo thứ tự xuất hiện", () => {
  const text = "@Bình với @Ngọc Anh cùng đi";
  const rs = findMentionRanges(text, MEMBERS);
  assert.equal(rs.length, 2);
  assert.ok(rs[0].start < rs[1].start, "phải sắp theo vị trí");
  assert.equal(text.slice(rs[0].start, rs[0].end), "@Bình");
  assert.equal(text.slice(rs[1].start, rs[1].end), "@Ngọc Anh");
});

test("không có gì để tìm thì trả mảng rỗng, không ném lỗi", () => {
  assert.deepEqual(findMentionRanges("", MEMBERS), []);
  assert.deepEqual(findMentionRanges("không nhắc ai", MEMBERS), []);
  assert.deepEqual(findMentionRanges("@KhôngCóAi", MEMBERS), []);
  assert.deepEqual(findMentionRanges("@Bình", []), []);
});

test("thành viên thiếu id hoặc thiếu tên thì bỏ qua, không làm hỏng cả hàm", () => {
  const messy = [{ id: "", name: "Trống" }, { id: "u3", name: "   " }, ...MEMBERS];
  assert.equal(findMentionRanges("@Bình", messy).length, 1);
});
