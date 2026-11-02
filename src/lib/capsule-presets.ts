/**
 * What the time-capsule form offers, so a letter to the future does not start
 * from three blanks: when it opens, what it is called, how it begins.
 *
 * The unlock date is a span ("1 năm") or one of the couple's own upcoming
 * days — a birthday, the day they met — because "open this on our next
 * anniversary" is what people mean far more often than a date they work out.
 * The title follows the choice until someone types their own.
 */

export const UNLOCK_SPANS = [
  { label: "1 tháng", months: 1 },
  { label: "6 tháng", months: 6 },
  { label: "1 năm", months: 12 },
  { label: "3 năm", months: 36 },
] as const;

/** A few first lines for a letter; a tap adds one to whatever is written. */
export const LETTER_STARTERS = [
  "Hôm nay mình viết thư này khi…",
  "Điều mình mong nhất cho hai đứa là…",
  "Một kỷ niệm mình không muốn quên…",
  "Lúc mở thư này, mong là…",
  "Cảm ơn vì…",
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `months` after a "YYYY-MM-DD" day, held to the end of a shorter month:
 * 31/01 plus one month is 28/02 (29 in a leap year), never 03/03.
 */
export function addMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/** The title a choice suggests: "Gửi An của 1 năm sau", "Gửi An nhân Ngày yêu nhau". */
export function capsuleTitle(partner: string, choice: { span?: string; occasion?: string }): string {
  const to = partner.trim() || "người ấy";
  if (choice.occasion) return `Gửi ${to} nhân ${choice.occasion}`.slice(0, 100);
  if (choice.span) return `Gửi ${to} của ${choice.span} sau`;
  return `Gửi ${to}`;
}

/** A starter goes after what is already written, on its own paragraph. */
export function addStarter(message: string, starter: string): string {
  const kept = message.trimEnd();
  return kept ? `${kept}\n\n${starter}` : starter;
}
