import { addDaysKey } from "@/lib/date-keys";
import { slugify } from "@/lib/slug";
import { dayKeysBetween } from "@/lib/notebook";

/**
 * Reshaping a notebook after it was made: its dates, its columns, whole days.
 *
 * Chủ repo (28/10): the notebook was "gò bó" — once created, its range and its
 * columns were fixed, and moving a day's plan meant three taps per cell. These
 * are the pure halves of those edits, shared by the server (which applies them)
 * and the screen (which warns before anything written would be lost), so node
 * can test them and the two cannot disagree.
 */

/** A day as stored: cells as a list, filed by column key. */
export type StoredCell = { slot: string; text: string; done: boolean };
export type StoredDay = { date: string; label: string; cells: StoredCell[] };
export type Slot = { key: string; label: string };

const filled = (d: StoredDay) => d.label.trim() !== "" || d.cells.some((c) => c.text.trim() !== "");
const emptyDay = (date: string, keys: readonly string[]): StoredDay => ({
  date,
  label: "",
  cells: keys.map((slot) => ({ slot, text: "", done: false })),
});

/**
 * The days of a new range: days inside it kept as they are, missing ones added
 * empty, the rest dropped. `lost` names the dropped days that had something
 * written on them — the screen asks before those go. Null for a range that is
 * backwards or longer than a notebook may be.
 */
export function applyRange(
  days: readonly StoredDay[],
  slotKeys: readonly string[],
  start: string,
  end: string,
): { days: StoredDay[]; added: number; lost: string[] } | null {
  const dates = dayKeysBetween(start, end);
  if (dates.length === 0) return null;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const inRange = new Set(dates);
  return {
    days: dates.map((date) => byDate.get(date) ?? emptyDay(date, slotKeys)),
    added: dates.filter((d) => !byDate.has(d)).length,
    lost: days.filter((d) => !inRange.has(d.date) && filled(d)).map((d) => d.date),
  };
}

/** A column as the settings form hands it back: an existing key, or none for a new one. */
export type SlotDraft = { key?: string; label: string };

/**
 * The column list after the settings form: kept columns renamed and reordered
 * as drafted, new ones given keys no existing column uses, missing ones gone.
 * A key is what cells are filed under, so a renamed column keeps its cells.
 */
export function applySlots(current: readonly Slot[], drafts: readonly SlotDraft[]): { slots: Slot[]; removed: string[] } {
  const known = new Set(current.map((s) => s.key));
  const kept = new Set(drafts.filter((d) => d.key && known.has(d.key)).map((d) => d.key!));
  const taken = new Set(kept);
  const slots = drafts.map((d, i) => {
    if (d.key && kept.has(d.key)) return { key: d.key, label: d.label };
    const base = slugify(d.label) || `cot-${i + 1}`;
    let key = base;
    for (let n = 2; taken.has(key) || known.has(key); n++) key = `${base}-${n}`;
    taken.add(key);
    return { key, label: d.label };
  });
  return { slots, removed: current.filter((s) => !kept.has(s.key)).map((s) => s.key) };
}

/** Each day re-filed for a column list: cells in column order, a new column empty, a removed one gone. */
export function cellsForSlots(days: readonly StoredDay[], slots: readonly Slot[]): StoredDay[] {
  return days.map((d) => ({
    ...d,
    cells: slots.map((s) => d.cells.find((c) => c.slot === s.key) ?? { slot: s.key, text: "", done: false }),
  }));
}

/** Columns that have something written in them on some day — removing one of those loses it. */
export function filledSlots(days: readonly StoredDay[]): Set<string> {
  return new Set(days.flatMap((d) => d.cells.filter((c) => c.text.trim() !== "").map((c) => c.slot)));
}

/**
 * One day's plan written onto others: its label and every cell's text, each
 * copy unticked — a meal planned for next Thursday has not been eaten yet.
 * Days not in the notebook, and the source itself, are skipped.
 */
export function copyDayTo(days: readonly StoredDay[], from: string, to: readonly string[]): StoredDay[] {
  const src = days.find((d) => d.date === from);
  if (!src) return [...days];
  const targets = new Set(to.filter((t) => t !== from));
  return days.map((d) =>
    targets.has(d.date)
      ? {
          ...d,
          label: src.label,
          cells: d.cells.map((c) => ({ slot: c.slot, text: src.cells.find((s) => s.slot === c.slot)?.text ?? "", done: false })),
        }
      : d,
  );
}

/** Two days exchanged whole — label, text and ticks — as when two training days trade places. */
export function swapDayContents(days: readonly StoredDay[], a: string, b: string): StoredDay[] {
  const da = days.find((d) => d.date === a);
  const db = days.find((d) => d.date === b);
  if (!da || !db || a === b) return [...days];
  return days.map((d) =>
    d.date === a ? { ...db, date: a } : d.date === b ? { ...da, date: b } : d,
  );
}

const mondayOffset = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;
};

export type Week = { index: number; start: string; end: string; dates: string[] };

/**
 * The plan in weeks, Monday to Sunday, the way a Vietnamese calendar reads.
 * The first and last may be partial; `start`/`end` are the calendar week's,
 * so a header still says which week it is.
 */
export function weeksOf(dates: readonly string[]): Week[] {
  const weeks: Week[] = [];
  for (const date of [...dates].sort()) {
    const start = addDaysKey(date, -mondayOffset(date));
    const last = weeks.at(-1);
    if (last && last.start === start) last.dates.push(date);
    else weeks.push({ index: weeks.length + 1, start, end: addDaysKey(start, 6), dates: [date] });
  }
  return weeks;
}

/** The same weekday as `from`, every later week of the plan — "copy to every Monday after this one". */
export function sameWeekdayAfter(dates: readonly string[], from: string): string[] {
  const w = mondayOffset(from);
  return dates.filter((d) => d > from && mondayOffset(d) === w);
}
