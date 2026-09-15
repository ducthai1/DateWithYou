import { test } from "node:test";
import assert from "node:assert/strict";
import { INVITE_FAILURES, inviteCodeFromInput, inviteErrorMessage } from "@/lib/invite-errors";

/*
 * The four ways joining fails have four different answers, and the code box in
 * onboarding used to give one answer to all of them ("Không tham gia được, thử
 * lại nhé") — advice that is wrong for three, and that keeps somebody typing a
 * code that will never work.
 */

test("mỗi lỗi joinByCode có một câu riêng, không câu nào trùng nhau", () => {
  const said = INVITE_FAILURES.map(inviteErrorMessage);
  assert.equal(new Set(said).size, INVITE_FAILURES.length);
  for (const s of said) assert.ok(s.length > 20, s);
});

test("hết hạn thì nói là hết hạn, đầy thì nói là đủ người", () => {
  assert.match(inviteErrorMessage("EXPIRED_CODE"), /hết hạn/);
  assert.match(inviteErrorMessage("SPACE_FULL"), /đủ hai người/);
  assert.match(inviteErrorMessage("ALREADY_MEMBER"), /đã ở trong không gian/);
});

test("lỗi lạ không bao giờ lộ mã nội bộ ra màn hình", () => {
  for (const raw of [null, undefined, "", "INTERNAL_SERVER_ERROR", "NO_SPACE", "TRPCError: boom"]) {
    const said = inviteErrorMessage(raw);
    assert.doesNotMatch(said, /[A-Z]{4,}_/, `${raw} → ${said}`);
    assert.match(said, /Chưa vào được/);
  }
});

test("dán nguyên đường liên kết vào ô mã thì lấy đúng mã ra", () => {
  assert.equal(inviteCodeFromInput("https://vivu-noplan.vercel.app/moi/ABCD234XYZ"), "ABCD234XYZ");
  assert.equal(inviteCodeFromInput("http://localhost:4488/moi/ABCD234XYZ"), "ABCD234XYZ");
  // Zalo và Messenger hay gắn thêm tham số theo dõi vào cuối đường liên kết.
  assert.equal(inviteCodeFromInput("https://x.app/moi/ABCD234XYZ?utm=zalo"), "ABCD234XYZ");
  assert.equal(inviteCodeFromInput("https://x.app/moi/ABCD234XYZ#top"), "ABCD234XYZ");
  assert.equal(inviteCodeFromInput("  https://x.app/moi/abcd234xyz/  "), "ABCD234XYZ");
});

test("gõ tay vẫn chạy: chữ thường thành hoa, dấu cách và gạch bị bỏ", () => {
  assert.equal(inviteCodeFromInput("abcd234xyz"), "ABCD234XYZ");
  assert.equal(inviteCodeFromInput("ABCD 234 XYZ"), "ABCD234XYZ");
  assert.equal(inviteCodeFromInput("ABCD-234-XYZ"), "ABCD234XYZ");
});

test("không nuốt ký tự của người đang gõ dở", () => {
  // Chạy ở mỗi phím bấm: "A" là một mã đang gõ, không phải mã sai.
  assert.equal(inviteCodeFromInput("A"), "A");
  assert.equal(inviteCodeFromInput("AB"), "AB");
  assert.equal(inviteCodeFromInput(""), "");
});

test("chặn ở 32 ký tự, đúng bằng mức joinByCode nhận", () => {
  assert.equal(inviteCodeFromInput("A".repeat(100)).length, 32);
});
