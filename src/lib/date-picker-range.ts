/**
 * The parts of the date picker that are only arithmetic.
 *
 * They live outside the component because `date-picker.tsx` is a `"use client"`
 * file and the unit runner cannot load React — so every rule about which years
 * are offered, which days are out of bounds and which month the calendar opens
 * on was, until this file existed, checkable only by opening a browser.
 *
 * Everything here works on **day keys**: `YYYY-MM-DD`, in the user's own local
 * time. Deliberately never `new Date("1998-06-15")` — a bare date string is
 * parsed as UTC midnight, so west of Greenwich it reads back as the 14th. Keys
 * are compared as strings, which is exact for a fixed-width format and needs no
 * timezone at all.
 */

/** A calendar day, `YYYY-MM-DD`. */
export type DayKey = string;

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day key of a local date. */
export function dayKey(d: Date): DayKey {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * A day key as a local midnight, or `null` for anything that is not one.
 *
 * Returns null rather than an Invalid Date so callers have to decide what an
 * absent birthday looks like instead of rendering "NaN/NaN/NaN".
 */
export function parseDayKey(key: string | null | undefined): Date | null {
  const m = key ? KEY_RE.exec(key) : null;
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // Rejects 2025-02-30, which the Date constructor would roll into March.
  return dayKey(date) === key ? date : null;
}

/**
 * The month the calendar opens on: the selected day, else the caller's
 * `defaultView`, else today — always the 1st, since only year and month are
 * read and the 31st of a month would roll over when stepping to a shorter one.
 */
export function openingMonth(
  value: string | undefined,
  defaultView: string | undefined,
  today: Date = new Date(),
): Date {
  const at = parseDayKey(value) ?? parseDayKey(defaultView) ?? today;
  return new Date(at.getFullYear(), at.getMonth(), 1);
}

/**
 * The years offered in the year list, ascending.
 *
 * Both ends come from the same `min`/`max` that bound the days, so one list
 * serves a birthday reaching back a century and a trip looking a few years
 * ahead, instead of a fixed range that is wrong for one of them. `viewYear` is
 * always included: a value outside the bounds must still be selectable in the
 * control that displays it, or the select shows a year that is not an option.
 */
export function yearOptions(opts: {
  min?: string;
  max?: string;
  viewYear: number;
  today?: Date;
}): number[] {
  const thisYear = (opts.today ?? new Date()).getFullYear();
  const max = opts.max ? Number(opts.max.slice(0, 4)) : thisYear + 10;
  const min = opts.min ? Number(opts.min.slice(0, 4)) : max - 100;
  const from = Math.min(min, opts.viewYear);
  const to = Math.max(max, opts.viewYear);
  const years: number[] = [];
  for (let y = from; y <= to; y++) years.push(y);
  return years;
}

/** Whether a day falls outside the caller's bounds, both ends inclusive. */
export function isOutOfRange(key: DayKey, bounds: { min?: string; max?: string }): boolean {
  if (bounds.max && key > bounds.max) return true;
  if (bounds.min && key < bounds.min) return true;
  return false;
}

/** How many days a month has, and which weekday (0 = Sunday) it starts on. */
export function monthGrid(year: number, month: number): { daysInMonth: number; firstWeekday: number } {
  return {
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    firstWeekday: new Date(year, month, 1).getDay(),
  };
}

/** What the trigger button shows: `dd/MM/yyyy`, or the placeholder when unset. */
export function formatDisplay(value: string | undefined, placeholder: string): string {
  const at = parseDayKey(value);
  if (!at) return placeholder;
  const d = String(at.getDate()).padStart(2, "0");
  const m = String(at.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${at.getFullYear()}`;
}
