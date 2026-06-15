// Date helpers shared by the calendar engine (client + server).
//
// The couple lives in Vietnam (Asia/Saigon, fixed UTC+7, no DST). Vercel runs
// the server in UTC, so naive `getDate()` on the server would bucket events into
// the wrong day. To keep the server and the browser agreeing on "which day", all
// day-bucketing routes through a fixed Saigon offset. Plan items / special dates
// store their day directly as a `YYYY-MM-DD` string (`dateKey`) so they need no
// timezone math at all; only real `Date` fields (memory.date, location.visitedAt)
// are converted via `dateKeyFromDate`.

export const SAIGON_OFFSET_MIN = 7 * 60;
const MIN_MS = 60_000;

/** `YYYY-MM-DD` for a real Date instant, in Saigon wall-clock time. */
export function dateKeyFromDate(d: Date | string | number): string {
  const ms = new Date(d).getTime() + SAIGON_OFFSET_MIN * MIN_MS;
  const s = new Date(ms);
  const y = s.getUTCFullYear();
  const m = String(s.getUTCMonth() + 1).padStart(2, "0");
  const day = String(s.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** UTC instant for Saigon midnight of the given calendar day (month is 1-12). */
export function saigonMidnightUtc(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day) - SAIGON_OFFSET_MIN * MIN_MS);
}

/** Half-open UTC range [from, to) covering an entire Saigon month (month 1-12). */
export function monthRangeUtc(year: number, month1: number): { from: Date; to: Date } {
  return {
    from: saigonMidnightUtc(year, month1, 1),
    to: saigonMidnightUtc(month1 === 12 ? year + 1 : year, month1 === 12 ? 1 : month1 + 1, 1),
  };
}

/** Half-open UTC range [from, to) covering a single Saigon day from its key. */
export function dayRangeUtc(key: string): { from: Date; to: Date } {
  const [y, m, d] = key.split("-").map(Number);
  return { from: saigonMidnightUtc(y, m, d), to: saigonMidnightUtc(y, m, d + 1) };
}

/** Lexical month prefix bounds for `dateKey` string range queries. */
export function monthKeyRange(year: number, month1: number): { fromKey: string; toKey: string } {
  const mm = String(month1).padStart(2, "0");
  const next = month1 === 12 ? `${year + 1}-01` : `${year}-${String(month1 + 1).padStart(2, "0")}`;
  return { fromKey: `${year}-${mm}-00`, toKey: `${next}-00` };
}

/** Today's key in Saigon time. */
export function todayKey(): string {
  return dateKeyFromDate(new Date());
}

/** Month/day ("MM-DD") slice of a date key — used for yearly recurrence match. */
export function monthDayOf(key: string): string {
  return key.slice(5);
}

/**
 * Weeks (Monday-first) covering a month grid, including leading/trailing days
 * from adjacent months so every row has 7 cells. Each cell carries its key and
 * whether it belongs to the displayed month.
 */
export type GridCell = { key: string; day: number; inMonth: boolean };
export function monthGridWeeks(year: number, month1: number): GridCell[][] {
  const first = new Date(Date.UTC(year, month1 - 1, 1));
  // JS: 0=Sun..6=Sat → Monday-first index 0=Mon..6=Sun.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month1 - 1, 1 - lead));
  const weeks: GridCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: GridCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start.getTime());
      cur.setUTCDate(start.getUTCDate() + w * 7 + d);
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const day = cur.getUTCDate();
      week.push({
        key: `${y}-${m}-${String(day).padStart(2, "0")}`,
        day,
        inMonth: cur.getUTCMonth() === month1 - 1,
      });
    }
    weeks.push(week);
    // Stop after the week that contains the last day of the month.
    const lastCell = week[6];
    if (w >= 4 && !lastCell.inMonth && week[0].inMonth === false) break;
  }
  return weeks;
}

/**
 * Days until the next occurrence of a special date from today (Saigon).
 * For yearly events, rolls to next year once this year's date has passed.
 * Returns 0 on the day itself.
 */
export function daysUntil(dateKey: string, recurYearly: boolean): number {
  const today = todayKey();
  const [, tm, td] = today.split("-").map(Number);
  const [ey, em, ed] = dateKey.split("-").map(Number);
  const ty = Number(today.slice(0, 4));
  const todayMid = Date.UTC(ty, tm - 1, td);
  let target: number;
  if (recurYearly) {
    target = Date.UTC(ty, em - 1, ed);
    if (target < todayMid) target = Date.UTC(ty + 1, em - 1, ed);
  } else {
    target = Date.UTC(ey, em - 1, ed);
  }
  return Math.round((target - todayMid) / (24 * 60 * MIN_MS));
}
