import { addDaysKey, daysBetweenKeys, todayKey } from "@/lib/date-keys";

/**
 * Working out the next date from the dates already known.
 *
 * Pure and dependency-free on purpose: the vault panel, the calendar and the
 * reminder cron must all arrive at the SAME date, and a shared pure function is
 * the only way three callers agree without one of them re-deriving it slightly
 * differently.
 */

/**
 * Plausible bounds for one cycle, in days.
 *
 * A gap outside this is not evidence about the rhythm — it is a mistyped year,
 * a month that was never logged, or two entries for the same period. Counting
 * it would move the estimate by weeks, which is exactly the failure someone
 * notices as "the app says the wrong date".
 */
const MIN_CYCLE_DAYS = 18;
const MAX_CYCLE_DAYS = 45;

/** How far forward we are willing to roll when months are missing. */
const MAX_ROLL_FORWARD = 24;

export type CyclePrediction = {
  /** The central expected start, on or after today, as a `YYYY-MM-DD` key. */
  nextStart: string;
  /**
   * The realistic window around `nextStart`, from the shortest and longest
   * cycles actually observed.
   *
   * Reported instead of a single confident date because a body does not keep
   * one fixed interval: with gaps of 28, 30 and 28 days the honest answer is
   * "somewhere in these three days", not "this day".
   */
  windowStart: string;
  windowEnd: string;
  /** The rhythm the central date rests on, in days. */
  cycleDays: number;
  /** The observed spread of the rhythm itself, in days. */
  shortestCycle: number;
  longestCycle: number;
  /** How many usable gaps informed the estimate. */
  samples: number;
};

/**
 * The rhythm, from EVERY usable gap, weighting recent months more heavily.
 *
 * This replaced a median. A median of three gaps is literally the middle one,
 * so a month that ran long contributed nothing at all — four months of careful
 * input were being answered as though two had been given, which is precisely
 * what the owner noticed. A mean uses all of them; linear recency weights
 * (oldest 1, newest n) then let the estimate follow a body that is drifting
 * rather than averaging its past and present equally.
 *
 * Robustness against a typo does not depend on this any more: the 18–45 day
 * filter has already removed gaps that could not be a real cycle, so what
 * reaches here is all genuine evidence and deserves to be counted.
 */
function weightedMean(gaps: readonly number[]): number {
  let weighted = 0;
  let weights = 0;
  gaps.forEach((gap, index) => {
    const weight = index + 1; // oldest gap = 1 … newest = gaps.length
    weighted += gap * weight;
    weights += weight;
  });
  return weighted / weights;
}

/**
 * The next expected start date, or null when there is not enough to say.
 *
 * Returns null rather than a guess on a single entry: one date carries no
 * rhythm at all, and showing a date derived from a textbook 28 days would look
 * like knowledge the app does not have.
 */
export function predictNextStart(
  rawStarts: readonly string[],
  today: string = todayKey(),
): CyclePrediction | null {
  // Deduped and ascending — the panel lets dates be entered in any order.
  const starts = [...new Set(rawStarts)].sort();
  if (starts.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetweenKeys(starts[i - 1], starts[i]);
    if (gap >= MIN_CYCLE_DAYS && gap <= MAX_CYCLE_DAYS) gaps.push(gap);
  }
  if (gaps.length === 0) return null;

  const cycleDays = Math.round(weightedMean(gaps));
  const shortestCycle = Math.min(...gaps);
  const longestCycle = Math.max(...gaps);

  /*
   * Roll forward past today rather than answering with a date already gone.
   *
   * If the most recent period was never logged, one step from the last known
   * start lands in the past — and a reminder for a date behind us is worse
   * than none. Stepping by whole cycles keeps the answer on the same rhythm.
   */
  let nextStart = addDaysKey(starts[starts.length - 1], cycleDays);
  for (let i = 0; i < MAX_ROLL_FORWARD && daysBetweenKeys(nextStart, today) > 0; i++) {
    nextStart = addDaysKey(nextStart, cycleDays);
  }

  /*
   * The window is the observed spread hung around the central date, so it
   * survives the roll-forward above without being recomputed from an anchor
   * that may be several cycles back.
   */
  return {
    nextStart,
    windowStart: addDaysKey(nextStart, -(cycleDays - shortestCycle)),
    windowEnd: addDaysKey(nextStart, longestCycle - cycleDays),
    cycleDays,
    shortestCycle,
    longestCycle,
    samples: gaps.length,
  };
}
