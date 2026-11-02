import { foldForSearch } from "@/lib/vietnamese-text";

/**
 * The days couples add first, so "Ngày đặc biệt" starts from a tap.
 *
 * A preset brings its name, its icon and "every year" with it. The ones that
 * fall on a fixed day — Valentine, 8/3, 20/10, Giáng sinh — bring the date
 * too, so there is nothing left to fill in. The others ("Ngày yêu nhau") are
 * the couple's own date, which only they know: the preset names it and leaves
 * the picker for the day.
 *
 * Birthdays are not here on purpose: each person's birthday is kept on their
 * account and written into the space by itself (see birthday-sync), so a
 * birthday typed here would be a second copy of the same day.
 */

export type DatePreset = {
  title: string;
  icon: string;
  /** "MM-DD" for a day that is the same for everyone. */
  monthDay?: string;
};

export const DATE_PRESETS: DatePreset[] = [
  { title: "Ngày yêu nhau", icon: "heart" },
  { title: "Kỷ niệm ngày cưới", icon: "gift" },
  { title: "Lần đầu gặp nhau", icon: "sparkles" },
  { title: "Valentine", icon: "heart", monthDay: "02-14" },
  { title: "Quốc tế Phụ nữ 8/3", icon: "gift", monthDay: "03-08" },
  { title: "Phụ nữ Việt Nam 20/10", icon: "gift", monthDay: "10-20" },
  { title: "Giáng sinh", icon: "star", monthDay: "12-24" },
];

/** The next time a fixed "MM-DD" comes round, counting today: the date the countdown should aim at. */
export function nextMonthDay(today: string, monthDay: string): string {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${monthDay}`;
  return thisYear >= today ? thisYear : `${year + 1}-${monthDay}`;
}

/** Presets not on the list yet, compared without accents or case. */
export function freshPresets(taken: string[]): DatePreset[] {
  const have = new Set(taken.map(foldForSearch));
  return DATE_PRESETS.filter((p) => !have.has(foldForSearch(p.title)));
}
