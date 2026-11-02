import { addDaysKey, daysBetweenKeys } from "@/lib/date-keys";
import { foldForSearch } from "@/lib/vietnamese-text";

/**
 * What the trip form and the packing list offer, so a trip is set up in taps.
 *
 * A length chip ("3N2Đ" — three days, two nights, the way trips are sold and
 * talked about here) moves the end date; the budget has round amounts; the
 * packing list starts from the things every trip needs, one tap each.
 */

export const TRIP_LENGTHS = [
  { label: "Trong ngày", days: 1 },
  { label: "2N1Đ", days: 2 },
  { label: "3N2Đ", days: 3 },
  { label: "4N3Đ", days: 4 },
  { label: "5N4Đ", days: 5 },
] as const;

export const BUDGET_PRESETS = [1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000];

export const PACKING_IDEAS = [
  "CCCD / giấy tờ",
  "Sạc dự phòng",
  "Thuốc cá nhân",
  "Kem chống nắng",
  "Áo khoác",
  "Áo mưa / ô",
  "Đồ bơi",
  "Bàn chải, kem đánh răng",
  "Tiền mặt",
  "Kính râm",
  "Dép",
  "Đồ ngủ",
];

/** The last day of a trip `days` long that starts on `start`. */
export const tripEnd = (start: string, days: number) => addDaysKey(start, days - 1);

/** How many days a start–end range spans, counting both ends: the length chip it matches. */
export const tripDays = (start: string, end: string) => daysBetweenKeys(start, end) + 1;

/** Packing ideas not on the list yet, compared without accents, case or spacing. */
export function freshPacking(taken: string[]): string[] {
  const have = new Set(taken.map(foldForSearch));
  return PACKING_IDEAS.filter((i) => !have.has(foldForSearch(i)));
}
