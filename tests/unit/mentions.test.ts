import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendMention,
  applyMention,
  filterMentionCandidates,
  findMentionRanges,
  mentionQueryAt,
  mentionToken,
} from "@/lib/mentions";

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

/*
 * Gõ "@" để CHỌN người, thay vì phải gõ đúng từng dấu.
 *
 * Phần dễ sai không nằm ở chỗ tìm thấy dấu "@" — mà ở chỗ biết khi nào KHÔNG
 * phải: giữa một địa chỉ email, sau khi câu đã đi tiếp, hay ở dòng khác. Mỗi
 * ca dưới đây là một cách hiểu sai riêng, không phải cùng một ca dài thêm.
 */

const CARET = (t: string) => t.indexOf("|");
const TEXT = (t: string) => t.replace("|", "");
/** Viết "|" vào chỗ con trỏ cho dễ đọc, rồi tách ra. */
const at = (marked: string) => mentionQueryAt(TEXT(marked), CARET(marked));

test("mentionQueryAt: đang gõ dở một cái tên thì mở", () => {
  assert.deepEqual(at("@|"), { start: 0, query: "" });
  assert.deepEqual(at("@Th|"), { start: 0, query: "Th" });
  assert.deepEqual(at("hôm nay đi với @Thủy M|"), { start: 15, query: "Thủy M" });
});

test("mentionQueryAt: email KHÔNG phải lời nhắc tên", () => {
  // Chữ ngay trước "@" là chữ cái ⇒ không ai đang gọi tên ai.
  assert.equal(at("mai@gm|"), null);
  assert.equal(at("lien.he2@x|"), null);
});

test("mentionQueryAt: chữ tiếng Việt trước @ vẫn phải bị loại", () => {
  /*
   * \w coi "ệ" là ký tự KHÔNG phải chữ, nên luật viết bằng \w sẽ mở danh sách
   * ngay giữa "kiệm@..." — phải là \p{L}.
   */
  assert.equal(at("tiếtkiệm@a|"), null);
  assert.equal(at("số3@a|"), null);
});

test("mentionQueryAt: câu đã đi tiếp thì đóng lại", () => {
  // Quá ba chữ là người ta đang viết câu, không phải gọi tên.
  assert.equal(at("@Thủy Mai ơi đi|"), null);
  // Dấu câu không nằm trong tên.
  assert.equal(at("@Thủy, còn|"), null);
  // Sang dòng khác là chuyện khác.
  assert.equal(at("@Thủy\nrồi|"), null);
  // Không có "@" nào thì thôi.
  assert.equal(at("chào buổi sáng|"), null);
});

test("filterMentionCandidates: gõ không dấu vẫn ra đúng người", () => {
  // Cả điểm của tính năng: gõ được đúng dấu rồi thì đã không cần danh sách.
  assert.deepEqual(filterMentionCandidates(MEMBERS, "ngoc").map((m) => m.id), ["u1"]);
  assert.deepEqual(filterMentionCandidates(MEMBERS, "BINH").map((m) => m.id), ["u2"]);
  assert.deepEqual(filterMentionCandidates(MEMBERS, "bìnhh").map((m) => m.id), []);
});

test("filterMentionCandidates: khớp theo đầu TỪ, không phải giữa từ", () => {
  // "anh" là chữ thứ hai của "Ngọc Anh" ⇒ nhận.
  assert.deepEqual(filterMentionCandidates(MEMBERS, "anh").map((m) => m.id), ["u1"]);
  // "nh" nằm giữa từ ⇒ không, nếu không thì gõ gì cũng ra mọi người.
  assert.deepEqual(filterMentionCandidates(MEMBERS, "nh").map((m) => m.id), []);
});

test("filterMentionCandidates: khớp cả tên tài khoản, và chưa gõ gì thì hiện hết", () => {
  assert.deepEqual(filterMentionCandidates(MEMBERS, "ngocanh").map((m) => m.id), ["u1"]);
  assert.equal(filterMentionCandidates(MEMBERS, "").length, MEMBERS.length);
});

test("applyMention: thay đúng đoạn đang gõ dở, con trỏ nằm sau khoảng trắng", () => {
  const text = "đi với @Thu";
  const q = mentionQueryAt(text, text.length);
  assert.ok(q);
  const out = applyMention(text, q, "Thủy Mai", text.length);
  assert.equal(out.text, "đi với @Thủy Mai ");
  assert.equal(out.caret, out.text.length);
});

test("applyMention: chèn GIỮA câu không nuốt phần đuôi", () => {
  /*
   * Ca mà hàng chip cũ không làm được: nó chỉ nối vào cuối. Ở đây phần sau con
   * trỏ phải còn nguyên, và con trỏ phải nằm ngay trước nó.
   */
  const text = "đi với @Thu rồi về";
  const caret = "đi với @Thu".length;
  const q = mentionQueryAt(text, caret);
  assert.ok(q);
  const out = applyMention(text, q, "Thủy Mai", caret);
  // MỘT khoảng trắng, không phải hai: phần đuôi đã mang sẵn một cái.
  assert.equal(out.text, "đi với @Thủy Mai rồi về");
  assert.equal(out.caret, "đi với @Thủy Mai".length);
  assert.ok(!/  /.test(out.text), `còn khoảng trắng đôi: ${JSON.stringify(out.text)}`);
});

test("applyMention rồi findMentionRanges: tên vừa chèn phải được nhận ra", () => {
  // Hai nửa phải khớp nhau, nếu không thì chọn xong pill không hiện.
  const text = "chào @Ng";
  const q = mentionQueryAt(text, text.length);
  assert.ok(q);
  const out = applyMention(text, q, "Ngọc Anh", text.length);
  const ranges = findMentionRanges(out.text, MEMBERS);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].id, "u1");
  assert.equal(out.text.slice(ranges[0].start, ranges[0].end), "@Ngọc Anh");
});
