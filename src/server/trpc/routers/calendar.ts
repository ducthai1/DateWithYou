import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { MemoryModel } from "@/server/db/models/memory";
import { LocationModel } from "@/server/db/models/location";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { SpaceModel } from "@/server/db/models/space";
import {
  monthRangeUtc,
  monthKeyRange,
  dayRangeUtc,
  dateKeyFromDate,
  monthDayOf,
  addDaysKey,
  daysBetweenKeys,
} from "@/lib/date-keys";
import { TripModel } from "@/server/db/models/trip";
import { normaliseTripStatus, tripDay, type TripStatus } from "@/lib/trip-status";
import { mergeTags, colorsForTags, BUCKET_ORDER, type BucketKey, type Tag } from "@/lib/plan-meta";

type TripLean = {
  _id: unknown;
  title: string;
  startDate: string;
  endDate: string;
  status?: string;
};

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type DaySummary = {
  planCount: number;
  doneCount: number;
  memoryCount: number;
  visitedCount: number;
  tagColors: string[];
  plans: { title: string; color: string; done: boolean }[];
  special: { title: string; icon: string | null } | null;
  thumbnailUrl: string | null;
  /**
   * The trip this day belongs to, if any. `first`/`last` mark the ends so the
   * grid can draw one continuous band across the stay instead of a separate
   * badge on each square — a five-day trip should look like five days away,
   * not like five unrelated appointments.
   */
  trip: {
    id: string;
    title: string;
    day: number;
    total: number;
    status: TripStatus;
    first: boolean;
    last: boolean;
  } | null;
};

export const calendarRouter = router({
  /** Per-day rollup for a month grid: counts, tag-dot colours, memory thumbnail,
   *  and special-date markers (custom special dates + the space anniversary). */
  monthSummary: protectedProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const { year, month } = input;
      const { from, to } = monthRangeUtc(year, month);
      const { fromKey, toKey } = monthKeyRange(year, month);
      const mm = String(month).padStart(2, "0");

      const [plans, memories, visited, specials, trips, space] = await Promise.all([
        PlanItemModel.find({ spaceId: ctx.spaceId, date: { $gte: fromKey, $lt: toKey } })
          .select("date status tags title")
          .lean(),
        MemoryModel.find({ spaceId: ctx.spaceId, date: { $gte: from, $lt: to } })
          .select("date photos")
          .lean(),
        LocationModel.find({
          spaceId: ctx.spaceId,
          status: "visited",
          visitedAt: { $gte: from, $lt: to },
        })
          .select("visitedAt")
          .lean(),
        SpecialDateModel.find({ spaceId: ctx.spaceId }).select("title date recurYearly icon").lean(),
        // Trips overlapping this month. Overlap, not containment: a trip that
        // starts in March and ends in April has to band both grids.
        TripModel.find({
          spaceId: ctx.spaceId,
          startDate: { $lt: toKey },
          endDate: { $gte: fromKey },
        })
          .select("title startDate endDate status")
          .sort({ startDate: 1 })
          .lean(),
        SpaceModel.findById(ctx.spaceId).select("tags anniversaryDate").lean<{
          tags?: Tag[];
          anniversaryDate?: Date;
        }>(),
      ]);

      const palette = mergeTags(space?.tags);
      const days: Record<string, DaySummary> = {};
      const get = (key: string): DaySummary =>
        (days[key] ??= {
          planCount: 0,
          doneCount: 0,
          memoryCount: 0,
          visitedCount: 0,
          tagColors: [],
          plans: [],
          special: null,
          thumbnailUrl: null,
          trip: null,
        });

      for (const p of plans) {
        const d = get(p.date as string);
        d.planCount++;
        if (p.status === "done") d.doneCount++;
        const pColors = colorsForTags((p.tags as string[]) ?? [], palette);
        for (const c of pColors) {
          if (!d.tagColors.includes(c)) d.tagColors.push(c);
        }
        if (d.plans.length < 3) {
          d.plans.push({
            title: p.title as string,
            color: pColors[0] ?? "",
            done: p.status === "done",
          });
        }
      }
      /*
       * Walk each trip day by day rather than tagging only the endpoints, so a
       * stay reads as one stretch across the grid. Trips are sorted by start
       * date and a later one does not overwrite a day an earlier one claimed,
       * which keeps two overlapping stays from flickering between each other
       * depending on collection order.
       */
      for (const t of trips) {
        const start = t.startDate as string;
        const end = t.endDate as string;
        const total = daysBetweenKeys(start, end) + 1;
        for (let i = 0; i < total; i++) {
          const key = addDaysKey(start, i);
          if (key < fromKey || key >= toKey) continue;
          const d = get(key);
          if (d.trip) continue;
          d.trip = {
            id: String(t._id),
            title: t.title as string,
            day: i + 1,
            total,
            status: normaliseTripStatus(t.status),
            first: i === 0,
            last: i === total - 1,
          };
        }
      }

      for (const m of memories) {
        const d = get(dateKeyFromDate(m.date as Date));
        d.memoryCount++;
        const first = (m.photos as { url: string }[])?.[0];
        if (first && !d.thumbnailUrl) d.thumbnailUrl = first.url;
      }
      for (const v of visited) {
        get(dateKeyFromDate(v.visitedAt as Date)).visitedCount++;
      }
      // Custom special dates: yearly events match by month; one-offs by year+month.
      for (const s of specials) {
        const sd = s.date as string;
        const matches = s.recurYearly ? monthDayOf(sd).slice(0, 2) === mm : sd.slice(0, 7) === `${year}-${mm}`;
        if (!matches) continue;
        const key = `${year}-${sd.slice(5)}`;
        get(key).special = { title: s.title as string, icon: (s.icon as string) ?? null };
      }
      // Space anniversary (single source of truth — not duplicated as a SpecialDate).
      if (space?.anniversaryDate) {
        const annKey = dateKeyFromDate(space.anniversaryDate);
        if (monthDayOf(annKey).slice(0, 2) === mm) {
          const key = `${year}-${annKey.slice(5)}`;
          // "heart" is a registry key — resolveIcon renders it as a Lucide Heart.
          // The fallback was previously a raw emoji ("💞") which bypassed the registry.
          get(key).special ??= { title: "Ngày kỷ niệm", icon: "heart" };
        }
      }
      return days;
    }),

  /** Everything pinned to one day: itinerary items, memories, visited places,
   *  matching special dates, and "on this day" memories from past years. */
  dayDetail: protectedProcedure
    .input(z.object({ date: dateKey }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const key = input.date;
      const { from, to } = dayRangeUtc(key);
      const md = monthDayOf(key);

      const [plans, memories, visited, specials, recent, tripDoc] = await Promise.all([
        PlanItemModel.find({ spaceId: ctx.spaceId, date: key }).lean(),
        MemoryModel.find({ spaceId: ctx.spaceId, date: { $gte: from, $lt: to } })
          // date/tags/embeds ride along so the day view can open a memory for
          // editing without a second round-trip just to fill the form.
          .select("title caption photos date tags embeds")
          .lean(),
        LocationModel.find({
          spaceId: ctx.spaceId,
          status: "visited",
          visitedAt: { $gte: from, $lt: to },
        })
          .select("name category")
          .lean(),
        SpecialDateModel.find({ spaceId: ctx.spaceId }).select("title date recurYearly icon").lean(),
        MemoryModel.find({ spaceId: ctx.spaceId, date: { $lt: from } })
          .select("title date photos")
          .sort({ date: -1 })
          .limit(300)
          .lean(),
        // The trip this day sits inside, if any — so the day can say which day
        // of the journey it is rather than leaving the items context-free.
        TripModel.findOne({
          spaceId: ctx.spaceId,
          startDate: { $lte: key },
          endDate: { $gte: key },
        })
          .select("title startDate endDate status")
          .sort({ startDate: 1 })
          // Typed explicitly: inside Promise.all the lean() result widens into a
          // union with the array-returning finds and every field falls off it.
          .lean<TripLean | null>(),
      ]);

      const tripSpan = tripDoc ? tripDay(tripDoc.startDate, tripDoc.endDate, key) : null;

      const items = plans
        .map((d) => ({
          id: String(d._id),
          title: d.title as string,
          note: (d.note as string) ?? null,
          bucket: d.bucket as BucketKey,
          time: (d.time as string) ?? null,
          order: (d.order as number) ?? 0,
          tags: (d.tags as string[]) ?? [],
          status: d.status as string,
          assigneeId: (d.assigneeId as string) ?? null,
          locationId: (d.locationId as string) ?? null,
          mediaId: (d.mediaId as string) ?? null,
        }))
        .sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || a.order - b.order || a.id.localeCompare(b.id));

      const onThisDay = recent
        .filter((m) => monthDayOf(dateKeyFromDate(m.date as Date)) === md)
        .slice(0, 5)
        .map((m) => ({
          id: String(m._id),
          title: m.title as string,
          year: Number(dateKeyFromDate(m.date as Date).slice(0, 4)),
          thumbnailUrl: (m.photos as { url: string }[])?.[0]?.url ?? null,
        }));

      return {
        items,
        memories: memories.map((m) => ({
          id: String(m._id),
          title: m.title as string,
          caption: (m.caption as string) ?? null,
          date: dateKeyFromDate(m.date as Date),
          tags: (m.tags as string[]) ?? [],
          embeds: ((m.embeds as { url: string }[]) ?? []).map((e) => ({ url: e.url })),
          photos: ((m.photos as { url: string; publicId: string }[]) ?? []).map((p) => ({
            url: p.url,
            publicId: p.publicId,
          })),
        })),
        visited: visited.map((v) => ({
          id: String(v._id),
          name: v.name as string,
          category: v.category as string,
        })),
        specials: specials
          .filter((s) => ((s.recurYearly as boolean) ? monthDayOf(s.date as string) === md : (s.date as string) === key))
          .map((s) => ({ id: String(s._id), title: s.title as string, icon: (s.icon as string) ?? null })),
        trip:
          tripDoc && tripSpan
            ? {
                id: String(tripDoc._id),
                title: tripDoc.title,
                day: tripSpan.day,
                total: tripSpan.total,
                status: normaliseTripStatus(tripDoc.status),
              }
            : null,
        onThisDay,
      };
    }),
});
