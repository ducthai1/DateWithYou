// Pure formatting helpers for the "Hôm nay" screen. Kept out of the card
// components so the same day-label / number rules can't drift between cards.

import { BUCKETS, type BucketKey } from "@/lib/plan-meta";
import { addDaysKey } from "@/lib/date-keys";

const WEEKDAYS = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

/** Weekday of a `YYYY-MM-DD` key. UTC-noon math so the Saigon offset can't
 *  push the date across a boundary (same trick as `addDaysKey`). */
function weekdayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

/** `dd/mm` from a `YYYY-MM-DD` key. */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/** Human day label relative to today: "Hôm nay" / "Ngày mai" / "Thứ Ba, 03/09". */
export function dayLabel(key: string, today: string): string {
  if (key === today) return "Hôm nay";
  if (key === addDaysKey(today, 1)) return "Ngày mai";
  return `${weekdayOf(key)}, ${shortDate(key)}`;
}

/** Vietnamese thousands separator (1234 → "1.234"). Written by hand rather
 *  than toLocaleString so the output is identical on every runtime. */
export function viNumber(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `-${grouped}` : grouped;
}

const BUCKET_LABEL: Record<string, string> = Object.fromEntries(
  BUCKETS.map((b) => [b.key, b.label]),
);

/** "Sáng" / "Trưa" / "Chiều" / "Tối" for a plan item's bucket. */
export function bucketLabel(bucket: BucketKey | string): string {
  return BUCKET_LABEL[bucket] ?? "";
}

/** "còn 3 ngày" / "hôm nay" / "ngày mai" for a non-negative day distance. */
export function daysAwayLabel(days: number): string {
  if (days <= 0) return "hôm nay";
  if (days === 1) return "ngày mai";
  return `còn ${days} ngày`;
}

/** "1000 ngày" or "2 năm" — the human name of a milestone target. */
export function milestoneLabel(target: number, years: number | null): string {
  return years ? `${years} năm` : `${viNumber(target)} ngày`;
}
