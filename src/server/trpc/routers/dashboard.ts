import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { TripModel } from "@/server/db/models/trip";
import { tripDay, tripStatus } from "@/lib/trip-status";
import { SpaceModel } from "@/server/db/models/space";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { MemoryModel } from "@/server/db/models/memory";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { TimeCapsuleModel } from "@/server/db/models/time-capsule";
import { addDaysKey, dateKeyFromDate, daysBetweenKeys, daysUntil, saigonMidnightUtc, todayKey } from "@/lib/date-keys";
import { BUCKET_ORDER, type BucketKey } from "@/lib/plan-meta";

/**
 * Aggregates the "Hôm nay" home screen in ONE round-trip.
 *
 * The screen is the app's only withdrawal surface — it hands the couple
 * something back for free — so it must not cost six waterfall queries to open.
 * Everything below runs inside a single Promise.all and is scoped to
 * `ctx.spaceId` (never a client-supplied id).
 */

/**
 * Fixed Saigon offset, the same one `src/lib/date-keys.ts` uses. Passed to the
 * Mongo date operators so "which calendar day is this Date on" is decided
 * identically in the database and in JS. Without it `$month`/`$dayOfMonth`
 * evaluate in UTC and a 23:30 Saigon memory lands on the previous day.
 */
const SAIGON_TZ = "+07:00";

/** How far ahead "sắp tới" looks. */
const UPCOMING_DAYS = 7;
/** Output bounds — the home screen is a glance surface, not a feed. */
const MAX_ON_THIS_DAY = 4;
const MAX_PLAN_ITEMS = 40;
const MAX_UPCOMING_ITEMS = 12;
const MAX_CAPSULES = 5;
const MAX_SPECIAL_DATES = 200;
/** A milestone is only worth surfacing this many days before it lands. */
const MILESTONE_WINDOW_DAYS = 7;



export type Milestone = {
  /** The round day-count being approached (100, 365, 1000…). */
  target: number;
  /** 0 = it lands today. */
  daysAway: number;
  /** Set when the target is a whole number of years (365, 730, 1095…). */
  years: number | null;
};

/**
 * Nearest upcoming round day-count, within MILESTONE_WINDOW_DAYS.
 * Candidates are every 100 days plus every 365 (yearly), so 100/200/365/500/
 * 730/1000/1095… all qualify without hard-coding a list that runs out.
 */
function nextMilestone(daysTogether: number): Milestone | null {
  if (daysTogether < 0) return null;

  const targets = new Set<number>();
  const baseHundred = Math.floor(daysTogether / 100) * 100;
  for (let t = baseHundred; t <= baseHundred + 200; t += 100) {
    if (t > 0) targets.add(t);
  }
  const baseYear = Math.floor(daysTogether / 365) * 365;
  for (let t = baseYear; t <= baseYear + 730; t += 365) {
    if (t > 0) targets.add(t);
  }

  let best: number | null = null;
  for (const t of targets) {
    const away = t - daysTogether;
    if (away < 0 || away > MILESTONE_WINDOW_DAYS) continue;
    if (best === null || t < best) best = t;
  }
  if (best === null) return null;

  return {
    target: best,
    daysAway: best - daysTogether,
    years: best % 365 === 0 ? best / 365 : null,
  };
}

/** Shape of the `onThisDay` aggregation output (projected fields only). */
type OnThisDayDoc = {
  _id: unknown;
  title: string;
  date: Date;
  caption?: string;
  photos?: { url: string }[];
};

type PlanDoc = {
  _id: unknown;
  title: string;
  date: string;
  bucket: BucketKey;
  time?: string;
  order?: number;
  status?: string;
  tags?: string[];
  assigneeId?: string;
  tripId?: string;
};

type TripDoc = {
  _id: unknown;
  title: string;
  startDate: string;
  endDate: string;
  status?: string;
};

type SpecialDoc = {
  _id: unknown;
  title: string;
  date: string;
  recurYearly?: boolean;
  icon?: string;
};

type CapsuleDoc = {
  _id: unknown;
  title: string;
  creatorId: string;
  unlockDate: Date;
};

function serialisePlan(d: PlanDoc) {
  return {
    id: String(d._id),
    title: d.title,
    date: d.date,
    bucket: d.bucket,
    time: d.time ?? null,
    status: d.status ?? "planned",
    tags: d.tags ?? [],
    assigneeId: d.assigneeId ?? null,
    // Lets the client tell an ordinary plan from one belonging to a trip that
    // is under way, so the same item is not listed twice on the same screen.
    tripId: d.tripId ?? null,
  };
}

export const dashboardRouter = router({
  /**
   * Everything the "Hôm nay" screen renders, in one query. Deliberately has no
   * input: the day is resolved server-side in Saigon time so two partners on
   * different devices always see the same "today".
   */
  today: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();

    const now = new Date();
    const today = todayKey();
    const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
    // Saigon midnight of today, as a UTC instant — the boundary for
    // "strictly an earlier year" memories.
    const todayStartUtc = saigonMidnightUtc(todayYear, todayMonth, todayDay);
    const upcomingLastKey = addDaysKey(today, UPCOMING_DAYS);

    const [space, specials, onThisDayDocs, planDocs, capsuleDocs, anyMemory, anyPlan, tripDocs] =
      await Promise.all([
        SpaceModel.findById(ctx.spaceId).select("anniversaryDate").lean<{
          anniversaryDate?: Date;
        } | null>(),

        SpecialDateModel.find({ spaceId: ctx.spaceId })
          .select("title date recurYearly icon")
          .limit(MAX_SPECIAL_DATES)
          .lean<SpecialDoc[]>(),

        /*
         * "Ngày này năm ấy" — matched IN THE DATABASE.
         *
         * `$expr` with $month/$dayOfMonth lets Mongo drop every non-matching
         * document before it crosses the wire. calendar.ts:147 instead pulls the
         * 300 most recent memories and filters them in JS, which both misses
         * older matches and ships data nobody reads; this does not copy that.
         *
         * The { spaceId, date } part of the match still uses the existing
         * `{ spaceId: 1, date: -1 }` index; $expr is evaluated on the (already
         * narrowed) candidates.
         */
        MemoryModel.aggregate([
          {
            $match: {
              spaceId: ctx.spaceId,
              date: { $lt: todayStartUtc },
              $expr: {
                $and: [
                  { $eq: [{ $month: { date: "$date", timezone: SAIGON_TZ } }, todayMonth] },
                  { $eq: [{ $dayOfMonth: { date: "$date", timezone: SAIGON_TZ } }, todayDay] },
                ],
              },
            },
          },
          { $sort: { date: -1 } },
          { $limit: MAX_ON_THIS_DAY },
          // Only the first photo is ever rendered as a thumbnail.
          { $project: { title: 1, date: 1, caption: 1, photos: { $slice: ["$photos", 1] } } },
        ]) as Promise<OnThisDayDoc[]>,

        // Today + the next UPCOMING_DAYS in one range read (plan-item stores the
        // day as a `YYYY-MM-DD` key, so this is a plain lexical string range and
        // rides the `{ spaceId: 1, date: 1 }` index).
        PlanItemModel.find({
          spaceId: ctx.spaceId,
          date: { $gte: today, $lte: upcomingLastKey },
        })
          .select("title date bucket time order status tags assigneeId tripId")
          .sort({ date: 1, order: 1 })
          .limit(MAX_PLAN_ITEMS)
          .lean<PlanDoc[]>(),

        // Unlocked but never opened — the "you have something waiting" moment.
        // Uses the `{ spaceId: 1, unlockDate: 1 }` index; `isOpened` is a
        // residual filter over the handful of rows that survive the range.
        TimeCapsuleModel.find({
          spaceId: ctx.spaceId,
          unlockDate: { $lte: now },
          isOpened: false,
        })
          .select("title creatorId unlockDate")
          .sort({ unlockDate: 1 })
          .limit(MAX_CAPSULES)
          .lean<CapsuleDoc[]>(),

        // First-run detection: "no memory today" and "no memory ever" need very
        // different copy, and a false empty state is the bug we are avoiding.
        MemoryModel.exists({ spaceId: ctx.spaceId }),
        PlanItemModel.exists({ spaceId: ctx.spaceId }),

        /*
         * A trip whose own dates contain today.
         *
         * Keyed on the dates, not on the stored status, on purpose: a couple
         * already on the road who forgot to flip a switch is exactly the case
         * this screen has to get right. The status still decides the wording
         * and whether an offer to start it appears — it just does not decide
         * whether the trip is acknowledged at all.
         *
         * Sorted by start date so a trip that began earlier wins if two ever
         * overlap, rather than the order Mongo happens to return.
         */
        TripModel.find({
          spaceId: ctx.spaceId,
          startDate: { $lte: today },
          endDate: { $gte: today },
        })
          .select("title startDate endDate")
          .sort({ startDate: 1 })
          .limit(1)
          .lean<TripDoc[]>(),
      ]);

    // a) Days together — whole days elapsed since the anniversary (0 on the day
    // itself, matching the "kỷ niệm 100 ngày" convention). Clamped at 0 so a
    // mistyped future anniversary can't render a negative count.
    const anniversaryDate = space?.anniversaryDate ?? null;
    const daysTogether = anniversaryDate
      ? Math.max(0, daysBetweenKeys(dateKeyFromDate(anniversaryDate), today))
      : null;

    // f) Milestone within the next week.
    const milestone = daysTogether === null ? null : nextMilestone(daysTogether);

    // b) Next special date. `daysUntil` already rolls a recurring date to next
    // year once this year's occurrence has passed (and clamps Feb-29).
    const nextSpecialDate = specials
      .map((s) => {
        const until = daysUntil(s.date, Boolean(s.recurYearly));
        return {
          id: String(s._id),
          title: s.title,
          icon: s.icon ?? null,
          date: s.date,
          // The day it actually lands this time round, ready to display.
          occursOn: until >= 0 ? addDaysKey(today, until) : s.date,
          daysUntil: until,
        };
      })
      .filter((s) => s.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)[0] ?? null;

    // c) Memories from the same month+day in an earlier year.
    const onThisDay = onThisDayDocs.map((m) => {
      const key = dateKeyFromDate(m.date);
      const year = Number(key.slice(0, 4));
      return {
        id: String(m._id),
        title: m.title,
        caption: m.caption ?? null,
        date: m.date,
        year,
        yearsAgo: todayYear - year,
        thumbnailUrl: m.photos?.[0]?.url ?? null,
      };
    });

    // d) Split the single plan read into today / the days after it.
    const todayPlans = planDocs
      .filter((p) => p.date === today)
      .map(serialisePlan)
      .sort(
        (a, b) =>
          (BUCKET_ORDER[a.bucket] ?? 0) - (BUCKET_ORDER[b.bucket] ?? 0) ||
          (a.time ?? "").localeCompare(b.time ?? ""),
      );

    const upcomingPlans = planDocs
      .filter((p) => p.date > today)
      .slice(0, MAX_UPCOMING_ITEMS)
      .map(serialisePlan);

    // e) Capsules whose unlock date has arrived and that nobody has opened yet.
    // Only the envelope is returned — the letter itself stays in capsule.list /
    // capsule.markOpened so the reveal happens in the Vault, not in a payload.
    // `fromSelf` is resolved here rather than shipping creatorId and making the
    // client fetch space.members just to compare two ids.
    const capsulesReady = capsuleDocs.map((c) => ({
      id: String(c._id),
      title: c.title,
      fromSelf: c.creatorId === ctx.userId,
      unlockDate: c.unlockDate,
    }));

    /*
     * g) The trip today belongs to, if there is one.
     *
     * Everything the card needs is worked out here rather than on the client:
     * which day of the trip today is, how much of today's itinerary is done,
     * and what comes next. `nextItem` is the first thing still outstanding in
     * chronological order — the question a person on a trip actually asks, and
     * one the client would otherwise have to re-derive from two lists.
     */
    const tripDoc = tripDocs[0] ?? null;
    let activeTrip = null;
    if (tripDoc) {
      const span = tripDay(tripDoc.startDate, tripDoc.endDate, today);
      const mine = todayPlans.filter((p) => p.tripId === String(tripDoc._id));
      const done = mine.filter((p) => p.status === "done").length;
      const next = mine.find((p) => p.status === "planned") ?? null;
      activeTrip = {
        id: String(tripDoc._id),
        title: tripDoc.title,
        startDate: tripDoc.startDate,
        endDate: tripDoc.endDate,
        status: tripStatus(tripDoc.startDate, tripDoc.endDate, today),
        day: span?.day ?? 1,
        totalDays: span?.total ?? 1,
        items: mine,
        doneCount: done,
        nextItem: next,
      };
    }

    return {
      today,
      activeTrip,
      anniversaryDate,
      daysTogether,
      milestone,
      nextSpecialDate,
      onThisDay,
      todayPlans,
      upcomingPlans,
      capsulesReady,
      hasAnyMemory: Boolean(anyMemory),
      hasAnyPlan: Boolean(anyPlan),
    };
  }),
});
