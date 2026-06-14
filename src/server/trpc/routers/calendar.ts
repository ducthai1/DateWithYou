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
} from "@/lib/date-keys";
import { mergeTags, colorsForTags, BUCKET_ORDER, type BucketKey, type Tag } from "@/lib/plan-meta";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type DaySummary = {
  planCount: number;
  doneCount: number;
  memoryCount: number;
  visitedCount: number;
  tagColors: string[];
  special: { title: string; icon: string | null } | null;
  thumbnailUrl: string | null;
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

      const [plans, memories, visited, specials, space] = await Promise.all([
        PlanItemModel.find({ spaceId: ctx.spaceId, date: { $gte: fromKey, $lt: toKey } })
          .select("date status tags")
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
          special: null,
          thumbnailUrl: null,
        });

      for (const p of plans) {
        const d = get(p.date as string);
        d.planCount++;
        if (p.status === "done") d.doneCount++;
        for (const c of colorsForTags((p.tags as string[]) ?? [], palette)) {
          if (!d.tagColors.includes(c)) d.tagColors.push(c);
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
          get(key).special ??= { title: "Kỷ niệm yêu nhau", icon: "💞" };
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

      const [plans, memories, visited, specials, recent] = await Promise.all([
        PlanItemModel.find({ spaceId: ctx.spaceId, date: key }).lean(),
        MemoryModel.find({ spaceId: ctx.spaceId, date: { $gte: from, $lt: to } })
          .select("title caption photos")
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
      ]);

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
        .sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || a.order - b.order);

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
        onThisDay,
      };
    }),
});
