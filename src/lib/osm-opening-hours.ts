/**
 * Reading OpenStreetMap's `opening_hours` tag — only the part worth trusting.
 *
 * The full syntax is a small language: month ranges, week numbers, sunset
 * offsets, public holidays, "open ends", comments in quotes. Implementing all
 * of it badly is worse than implementing a little of it well, because the
 * failure mode is not an error — it is telling somebody a place is open when
 * it is shut, and sending them across town.
 *
 * So this handles the four shapes that actually cover most Vietnamese venues
 * and **returns null for everything else**. Null means "we do not know", which
 * the planner already treats as usable-with-a-warning. That is the honest
 * answer, and it is what most of these rows deserve.
 *
 *   24/7
 *   Mo-Su 10:00-23:00
 *   Mo-Fr 08:00-17:00; Sa 09:00-12:00
 *   Mo-Su 18:00-05:00          (past midnight — isOpenAt already understands)
 */

/** Sunday = 0, matching `Date#getDay`. */
const DAY_INDEX: Record<string, number> = {
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
};

export type OpeningWindow = { openTime: string; closeTime: string };

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function hhmm(raw: string): string | null {
  const m = TIME.exec(raw.trim());
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Does this day selector ("Mo-Fr", "Sa,Su", "Mo") cover `weekday`? */
function covers(selector: string, weekday: number): boolean {
  for (const part of selector.split(",")) {
    const range = part.trim().toLowerCase();
    if (!range) continue;
    const [fromRaw, toRaw] = range.split("-");
    const from = DAY_INDEX[fromRaw];
    if (from === undefined) return false;
    if (toRaw === undefined) {
      if (from === weekday) return true;
      continue;
    }
    const to = DAY_INDEX[toRaw];
    if (to === undefined) return false;
    // Mo-Su, and also wrapping selectors like Fr-Mo.
    if (from <= to) {
      if (weekday >= from && weekday <= to) return true;
    } else if (weekday >= from || weekday <= to) return true;
  }
  return false;
}

/**
 * The window for one weekday, or null when the tag says something this does
 * not understand.
 *
 * @param weekday Sunday = 0.
 */
export function openingWindowFor(tag: unknown, weekday: number): OpeningWindow | null {
  if (typeof tag !== "string") return null;
  const value = tag.trim();
  if (!value) return null;
  if (value === "24/7") return { openTime: "00:00", closeTime: "23:59" };

  // Anything carrying these means a rule we are not going to read correctly.
  // Guessing here puts somebody in front of a locked door.
  if (/(ph|su\[|week|easter|sunrise|sunset|open|"|\|\|)/i.test(value.replace(/\bsu\b/gi, ""))) {
    return null;
  }

  for (const rule of value.split(";")) {
    const text = rule.trim();
    if (!text) continue;
    if (/\boff\b/i.test(text)) continue;         // a closure rule, not a window
    const m = /^([A-Za-z,\-]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(text);
    if (!m) {
      // A bare time range with no days ("10:00-22:00") applies every day.
      const bare = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(text);
      if (bare) {
        const openTime = hhmm(bare[1]);
        const closeTime = hhmm(bare[2]);
        if (openTime && closeTime) return { openTime, closeTime };
      }
      continue;
    }
    if (!covers(m[1], weekday)) continue;
    const openTime = hhmm(m[2]);
    const closeTime = hhmm(m[3]);
    if (!openTime || !closeTime) return null;
    return { openTime, closeTime };
  }
  return null;
}
