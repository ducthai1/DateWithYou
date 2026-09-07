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
 * it would move the average by weeks, which is exactly the failure someone
 * notices as "the app says the wrong date".
 */
const MIN_CYCLE_DAYS = 18;
const MAX_CYCLE_DAYS = 45;

/** How far forward we are willing to roll when months are missing. */
const MAX_ROLL_FORWARD = 24;

export type CyclePrediction = {
  /** The next expected start, on or after today, as a `YYYY-MM-DD` key. */
  nextStart: string;
  /** The rhythm the prediction rests on, in days. */
  cycleDays: number;
  /**
   * Honest ± around `nextStart`, in days, taken from how much the observed
   * gaps actually varied. Shown to the reader rather than hidden: a single
   * confident-looking date from a body that varies by five days is a promise
   * the data cannot keep.
   */
  spreadDays: number;
  /** How many usable gaps the rhythm was measured from. */
  samples: number;
};

/**
 * Median, not mean.
 *
 * With only four or five entries a single wrong digit drags a mean by days,
 * while the median simply ignores it. Robustness matters more than precision
 * here because the input is typed by hand from memory.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

  const cycleDays = Math.round(median(gaps));
  const spreadDays = Math.max(...gaps.map((gap) => Math.abs(gap - cycleDays)));

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

  return { nextStart, cycleDays, spreadDays, samples: gaps.length };
}
