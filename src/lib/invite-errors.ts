/**
 * What a refused invitation means, in words for the person holding the code.
 *
 * `joinByCode` tells four different failures apart on purpose — a code that is
 * spent, one that has expired, a space that already has two people, and being
 * in it already — because "mã không hợp lệ hoặc đã hết hạn" is the wrong thing
 * to say to three of them, and it sends people off to ask for a new code that
 * would not have helped.
 *
 * That distinction is only worth making if every screen that can join makes
 * it. There are two: the invite link, and the code box in onboarding. The
 * second one was still collapsing all four into "Không tham gia được, thử lại
 * nhé" — so somebody joining a full space was told to try again, forever. The
 * words live here so the two screens cannot drift apart again.
 */

/** The failures `space.joinByCode` reports by name. */
export const INVITE_FAILURES = [
  "INVALID_OR_EXPIRED_CODE",
  "EXPIRED_CODE",
  "ALREADY_MEMBER",
  "SPACE_FULL",
] as const;

export type InviteFailure = (typeof INVITE_FAILURES)[number];

/*
 * Mỗi câu nói hai điều: chuyện gì đã xảy ra, và làm gì tiếp.
 *
 * "Nhờ người kia tạo mã mới" là lời khuyên đúng nhưng người nhận lời mời không
 * biết cái nút đó nằm ở đâu để mà nhắn lại cho chính xác — nên đường đi được
 * gọi tên luôn. Chỗ này lấy theo bản đầy đủ của trang /moi, vốn đã nói đúng.
 */
const MESSAGES: Record<InviteFailure, string> = {
  EXPIRED_CODE:
    "Lời mời đã hết hạn — chỉ dùng được 7 ngày. Nhờ người kia mở Cài đặt → Mời người đồng hành để tạo lời mời mới nhé.",
  INVALID_OR_EXPIRED_CODE:
    "Mã này không dùng được — có thể đã có người dùng rồi, hoặc đã bị thay bằng mã mới. Nhờ người kia tạo lời mời mới nhé.",
  ALREADY_MEMBER: "Bạn đã ở trong không gian này rồi — mở ứng dụng lên là thấy nhau thôi.",
  SPACE_FULL: "Không gian đó đã đủ hai người. Nhắn lại cho người đã mời bạn nhé.",
};

/*
 * The same four things, said in four words instead of thirty.
 *
 * A toast and a screen saying the identical paragraph is not emphasis, it is a
 * bug you can read: /moi renders the full explanation as its whole reason for
 * existing, and a toast repeating it word for word looked like the page had
 * fired twice. The screen keeps the sentence that tells you what to DO; the
 * toast becomes the alert that something happened. Both still come from here,
 * so the pair cannot drift the way the three join screens already did once.
 */
const HEADLINES: Record<InviteFailure, string> = {
  EXPIRED_CODE: "Lời mời đã hết hạn",
  INVALID_OR_EXPIRED_CODE: "Mã này không dùng được nữa",
  ALREADY_MEMBER: "Bạn đã ở trong không gian này rồi",
  SPACE_FULL: "Không gian đó đã đủ hai người",
};

/** The short form, for a surface that is already explaining itself. */
export function inviteErrorHeadline(reason: string | null | undefined): string {
  if (reason && reason in HEADLINES) return HEADLINES[reason as InviteFailure];
  return "Chưa vào được không gian";
}

/**
 * A sentence for whatever the server said, including things it has never said.
 *
 * Anything unrecognised gets the generic line rather than the raw error text:
 * a tRPC message can be an internal code, and showing one to a person is how
 * "INTERNAL_SERVER_ERROR" ends up on a screen somebody's partner is looking at.
 */
export function inviteErrorMessage(reason: string | null | undefined): string {
  if (reason && reason in MESSAGES) return MESSAGES[reason as InviteFailure];
  return "Chưa vào được không gian. Kiểm tra lại mã giúp mình, hoặc thử lại sau một chút nhé.";
}

/**
 * The code inside whatever somebody pasted.
 *
 * What gets shared now is a LINK — that is what the invite panel hands out,
 * and what arrives in a Zalo message. The box in onboarding asks for a "mã",
 * so the obvious thing to do with a link is paste it there, and the obvious
 * result was "Mã sai hoặc đã hết hạn" for a code that was perfectly good.
 *
 * Runs on every keystroke, so it must never eat what somebody is still
 * typing: no length check here (a one-letter code is a code in progress), and
 * the shape is left for the server to reject.
 */
export function inviteCodeFromInput(raw: string): string {
  const fromLink = raw.match(/\/moi\/([^/?#\s]+)/i);
  const candidate = fromLink ? fromLink[1] : raw;
  return candidate
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
}
