import { addDaysKey, daysBetweenKeys } from "@/lib/date-keys";
import { slugify } from "@/lib/slug";

/**
 * Sổ tay: a notebook that is notes plus a day-by-day plan.
 *
 * The owner kept a 20-day eating plan as lines inside a recipe card and found it
 * "khó nhìn" — a recipe is a list of ingredients, not a timetable. A notebook
 * has columns (slots: "Trưa 12h", "Tối 19h30", "Tập"), one row per day, a few
 * free-text sections (notes, milestones, shopping) and an optional daily number
 * (the morning weigh-in) drawn against its targets.
 *
 * The pieces both ends need — limits, the day range, which day to put on top —
 * live here so the server and the screen cannot disagree about them, and so
 * node can test them.
 */

export const NOTEBOOK_LIMITS = {
  title: 80,
  slotLabel: 24,
  slots: 6,
  days: 120,
  cellText: 500,
  dayLabel: 40,
  sectionTitle: 40,
  sectionBody: 4000,
  sections: 8,
  metricLabel: 24,
  metricUnit: 8,
} as const;

/** A reading outside this is a typo, not a weigh-in (or a pulse, or a step count in thousands). */
export const METRIC_RANGE = { min: 0, max: 100_000 } as const;

export type NotebookCell = { text: string; done: boolean };
export type NotebookDay = { date: string; label: string; cells: Record<string, NotebookCell> };
export type CellRef = { date: string; slot: string };

/** Every day key from `start` to `end`, both included; empty when the range is backwards or too long. */
export function dayKeysBetween(start: string, end: string): string[] {
  const n = daysBetweenKeys(start, end);
  if (!Number.isFinite(n) || n < 0 || n + 1 > NOTEBOOK_LIMITS.days) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDaysKey(start, i));
}

/**
 * Stable keys for column labels. The key is what each cell is filed under, so a
 * column can be renamed later without touching its cells; two columns with the
 * same name ("Bữa phụ", "Bữa phụ") still get distinct keys.
 */
export function slotKeysFor(labels: readonly string[]): string[] {
  const taken = new Set<string>();
  return labels.map((label, i) => {
    const base = slugify(label) || `cot-${i + 1}`;
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    taken.add(key);
    return key;
  });
}

/**
 * The day the screen opens on: today while the plan is running, the first day
 * before it starts, the last day after it ends. Null only for an empty plan.
 */
export function focusDay(dates: readonly string[], today: string): string | null {
  if (dates.length === 0) return null;
  if (dates.includes(today)) return today;
  if (today < dates[0]) return dates[0];
  return dates[dates.length - 1];
}

/**
 * The plan with two cells exchanged — text AND tick, because a meal moved to
 * another day carries whether it was eaten. Same cell twice, or a cell that is
 * not there, changes nothing. Used for the optimistic update; the server does
 * the same exchange on its own copy.
 */
export function swapCells(days: readonly NotebookDay[], a: CellRef, b: CellRef): NotebookDay[] {
  if (a.date === b.date && a.slot === b.slot) return [...days];
  const ca = days.find((d) => d.date === a.date)?.cells[a.slot];
  const cb = days.find((d) => d.date === b.date)?.cells[b.slot];
  if (!ca || !cb) return [...days];
  return days.map((d) => {
    if (d.date !== a.date && d.date !== b.date) return d;
    const cells = { ...d.cells };
    if (d.date === a.date) cells[a.slot] = { ...cb };
    if (d.date === b.date) cells[b.slot] = { ...ca };
    return { ...d, cells };
  });
}

/** How many cells of a day are ticked, out of how many have something written in them. */
export function dayProgress(day: NotebookDay): { done: number; total: number } {
  const filled = Object.values(day.cells).filter((c) => c.text.trim() !== "");
  return { done: filled.filter((c) => c.done).length, total: filled.length };
}

/**
 * The vertical range of the weigh-in chart: every reading and every target in
 * view, with a little air so the line never sits on the frame. A flat series
 * (one reading, or all the same) still gets a range, or the scale divides by 0.
 */
export function chartRange(values: readonly number[]): { min: number; max: number } | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (max - min < 1) {
    const mid = (max + min) / 2;
    min = mid - 0.5;
    max = mid + 0.5;
  }
  const pad = (max - min) * 0.15;
  return { min: min - pad, max: max + pad };
}

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAY_LONG = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const weekdayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
};

/** "T6", "CN" */
export const weekdayShort = (key: string) => WEEKDAY_SHORT[weekdayOf(key)];
/** "Thứ 6", "Chủ nhật" */
export const weekdayLong = (key: string) => WEEKDAY_LONG[weekdayOf(key)];
/** "23/10" */
export const dayMonth = (key: string) => `${Number(key.slice(8, 10))}/${Number(key.slice(5, 7))}`;

/** "61,4" — the way a Vietnamese reader writes a weight, one decimal, no trailing ",0". */
export function formatReading(value: number): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

/** Accepts "61,4", "61.4" and " 61 "; anything else is null. */
export function parseReading(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return v > METRIC_RANGE.min && v < METRIC_RANGE.max ? v : null;
}
