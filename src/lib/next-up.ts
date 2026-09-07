import { daysUntil, daysBetweenKeys, addDaysKey } from "@/lib/date-keys";

/**
 * Choosing the one thing to count down to.
 *
 * Kept pure and out of the router so the choice can be simulated: the thing
 * that most needs checking here is the ORDERING across two different kinds of
 * event (does a trip leaving in five days beat an anniversary ten months out?),
 * and none of that needs a database to check.
 */

export type NextUpKind = "special" | "trip";

export type NextUp = {
  kind: NextUpKind;
  title: string;
  /** Icon registry key — resolveIcon turns it into a themed Lucide SVG. */
  icon: string | null;
  daysUntil: number;
  /**
   * The day it actually lands, ready to print.
   *
   * For a recurring date this is the resolved next occurrence, not the stored
   * birth year. For a trip it is the departure day, which for one already
   * under way is in the past while `daysUntil` reads 0 — the trip is happening
   * now, and callers that show both should say "đang đi", not a date away.
   */
  occursOn: string;
  /** Where tapping it goes, when there is somewhere to go. */
  href: string | null;
};

export type SpecialInput = {
  title: string;
  date: string;
  recurYearly?: boolean;
  icon?: string | null;
};

/** Trips carry `YYYY-MM-DD` strings, matching every other day-keyed feature. */
export type TripInput = { id: string; title: string; startDate: string };

/**
 * The soonest upcoming event across both kinds, or null when there is none.
 *
 * Trips are passed in already filtered to those still relevant (endDate today
 * or later), so one already under way arrives here and reads as zero days out
 * rather than vanishing the moment it starts.
 */
export function pickNextUp(
  specials: readonly SpecialInput[],
  trips: readonly TripInput[],
  today: string,
): NextUp | null {
  const candidates: NextUp[] = [];

  for (const s of specials) {
    // A recurring date rolls to its next occurrence (and clamps Feb-29).
    const until = daysUntil(s.date, Boolean(s.recurYearly));
    if (until < 0) continue;
    candidates.push({
      kind: "special",
      title: s.title,
      icon: s.icon ?? null,
      daysUntil: until,
      occursOn: addDaysKey(today, until),
      href: null,
    });
  }

  for (const t of trips) {
    candidates.push({
      kind: "trip",
      title: t.title,
      icon: "plane",
      // Clamped: a trip that began yesterday is happening now, not overdue.
      daysUntil: Math.max(0, daysBetweenKeys(today, t.startDate)),
      occursOn: t.startDate,
      href: `/trips/${t.id}`,
    });
  }

  // Soonest wins. On a tie a celebration reads better than a departure in a
  // one-line chip, so specials come first.
  candidates.sort((a, b) => a.daysUntil - b.daysUntil || (a.kind === "special" ? -1 : 1));
  return candidates[0] ?? null;
}
