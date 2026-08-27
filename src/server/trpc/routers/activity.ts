import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MemoryModel } from "@/server/db/models/memory";
import { LocationModel } from "@/server/db/models/location";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { TripModel } from "@/server/db/models/trip";
import { TimeCapsuleModel } from "@/server/db/models/time-capsule";
import { WishlistItemModel } from "@/server/db/models/wishlist-item";
import { MediaItemModel } from "@/server/db/models/media-item";
import { RoadmapPlanModel } from "@/server/db/models/roadmap-plan";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { MemberStateModel } from "@/server/db/models/member-state";

/**
 * Partner activity feed — DERIVED, not logged.
 *
 * Nothing writes an activity row. The feed is a merge of the content
 * collections that already carry `createdBy` + timestamps, each queried on its
 * `{ spaceId: 1, createdAt: -1 }` index. Two reasons this beats an activity
 * log here: it covers every record the couple already has (a log would start
 * empty and the history before it would be invisible forever), and adding a
 * feed never requires editing the routers that own those collections.
 *
 * Cost: one indexed, field-narrowed, limited find per collection, in parallel.
 */

// The value exists so ActivityKind can be derived from it below, which keeps
// the list and the type from drifting apart. Nothing reads it at runtime, and
// deleting it to satisfy the linter would take the type with it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const KINDS = [
  "memory",
  "location",
  "plan",
  "trip",
  "capsule",
  "wishlist",
  "media",
  "roadmap",
  "specialDate",
] as const;

export type ActivityKind = (typeof KINDS)[number];

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  actorId: string;
  /** The thing's own name. The verb ("đã thêm …") is composed in the UI. */
  title: string;
  /** Optional context line; null when the title already says everything. */
  subtitle: string | null;
  href: string;
  createdAt: Date;
};

/** `YYYY-MM-DD` day key → `DD/MM/YYYY`. Day keys need no timezone math. */
function viDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return y && m && d ? `${d}/${m}/${y}` : dayKey;
}

const MEDIA_KIND_LABEL: Record<string, string> = {
  music: "Nhạc",
  food_video: "Video món ngon",
  recipe: "Công thức",
  game: "Trò chơi",
};

const feedInput = z.object({
  limit: z.number().int().min(1).max(100).default(30),
  /** Keyset pagination: only items strictly older than this instant. */
  before: z.coerce.date().optional(),
});

/**
 * Unread is capped per collection because the badge only ever renders "9+".
 * Counting past 10 in any one collection cannot change what is displayed.
 */
const UNREAD_CAP_PER_COLLECTION = 10;

export const activityRouter = router({
  feed: protectedProcedure
    .input(feedInput.optional())
    .query(async ({ ctx, input }) => {
      await connectToDatabase();

      const limit = input?.limit ?? 30;
      const before = input?.before;
      // Every branch keeps `spaceId` first so the compound index is usable and
      // tenant isolation is impossible to forget on any one of the nine reads.
      const base = {
        spaceId: ctx.spaceId,
        ...(before ? { createdAt: { $lt: before } } : {}),
      };
      const page = { sort: { createdAt: -1 as const }, limit };

      type Row<T> = T & { _id: unknown; createdAt: Date };

      const [
        memories,
        locations,
        planItems,
        trips,
        capsules,
        wishes,
        media,
        roadmaps,
        specialDates,
      ] = await Promise.all([
        MemoryModel.find(base, null, page)
          .select("_id createdBy title createdAt")
          .lean<Row<{ createdBy: string; title: string }>[]>(),
        LocationModel.find(base, null, page)
          .select("_id createdBy name district createdAt")
          .lean<Row<{ createdBy: string; name: string; district: string }>[]>(),
        PlanItemModel.find(base, null, page)
          .select("_id createdBy title date createdAt")
          .lean<Row<{ createdBy: string; title: string; date: string }>[]>(),
        TripModel.find(base, null, page)
          .select("_id createdBy title startDate endDate createdAt")
          .lean<
            Row<{ createdBy: string; title: string; startDate: string; endDate: string }>[]
          >(),
        // Time capsules name the author `creatorId`, not `createdBy`.
        TimeCapsuleModel.find(base, null, page)
          .select("_id creatorId title createdAt")
          .lean<Row<{ creatorId: string; title: string }>[]>(),
        WishlistItemModel.find(base, null, page)
          .select("_id createdBy itemName createdAt")
          .lean<Row<{ createdBy: string; itemName: string }>[]>(),
        MediaItemModel.find(base, null, page)
          .select("_id createdBy title kind createdAt")
          .lean<Row<{ createdBy: string; title: string; kind: string }>[]>(),
        RoadmapPlanModel.find(base, null, page)
          .select("_id createdBy title category createdAt")
          .lean<Row<{ createdBy: string; title: string; category?: string }>[]>(),
        SpecialDateModel.find(base, null, page)
          .select("_id createdBy title date createdAt")
          .lean<Row<{ createdBy: string; title: string; date: string }>[]>(),
      ]);

      const items: ActivityItem[] = [
        ...memories.map((d) => ({
          id: String(d._id),
          kind: "memory" as const,
          actorId: d.createdBy,
          title: d.title,
          subtitle: null,
          href: "/timeline",
          createdAt: d.createdAt,
        })),
        ...locations.map((d) => ({
          id: String(d._id),
          kind: "location" as const,
          actorId: d.createdBy,
          title: d.name,
          subtitle: d.district || null,
          href: "/map",
          createdAt: d.createdAt,
        })),
        ...planItems.map((d) => ({
          id: String(d._id),
          kind: "plan" as const,
          actorId: d.createdBy,
          title: d.title,
          subtitle: viDay(d.date),
          href: "/calendar",
          createdAt: d.createdAt,
        })),
        ...trips.map((d) => ({
          id: String(d._id),
          kind: "trip" as const,
          actorId: d.createdBy,
          title: d.title,
          subtitle: `${viDay(d.startDate)} – ${viDay(d.endDate)}`,
          href: `/trips/${String(d._id)}`,
          createdAt: d.createdAt,
        })),
        ...capsules.map((d) => ({
          id: String(d._id),
          kind: "capsule" as const,
          actorId: d.creatorId,
          title: d.title,
          subtitle: null,
          href: "/vault",
          createdAt: d.createdAt,
        })),
        ...wishes.map((d) => ({
          id: String(d._id),
          kind: "wishlist" as const,
          actorId: d.createdBy,
          title: d.itemName,
          subtitle: null,
          href: "/vault",
          createdAt: d.createdAt,
        })),
        ...media.map((d) => ({
          id: String(d._id),
          kind: "media" as const,
          actorId: d.createdBy,
          title: d.title,
          subtitle: MEDIA_KIND_LABEL[d.kind] ?? null,
          href: "/library",
          createdAt: d.createdAt,
        })),
        ...roadmaps.map((d) => ({
          id: String(d._id),
          kind: "roadmap" as const,
          actorId: d.createdBy,
          title: d.title,
          subtitle: d.category || null,
          href: "/vault",
          createdAt: d.createdAt,
        })),
        ...specialDates.map((d) => ({
          id: String(d._id),
          kind: "specialDate" as const,
          actorId: d.createdBy,
          title: d.title,
          subtitle: viDay(d.date),
          href: "/calendar",
          createdAt: d.createdAt,
        })),
      ];

      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const pageItems = items.slice(0, limit);

      return {
        items: pageItems,
        // Non-null only when the merge actually had more than one page's worth,
        // so "there is older activity" is a fact, not a guess.
        nextCursor:
          items.length > pageItems.length && pageItems.length
            ? pageItems[pageItems.length - 1].createdAt
            : null,
      };
    }),

  /**
   * How many partner-authored items landed since this member last opened the
   * feed. The member's own actions are never unread — at n=2 a badge for your
   * own typing is pure noise.
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();

    const state = await MemberStateModel.findOne({
      spaceId: ctx.spaceId,
      userId: ctx.userId,
    })
      .select("lastSeenActivityAt")
      .lean<{ lastSeenActivityAt?: Date }>();

    const since = state?.lastSeenActivityAt;
    // No watermark yet = never opened the feed, so everything the partner made
    // is unread. Treating it as "nothing new" would hide the first real signal.
    const range = since ? { createdAt: { $gt: since } } : {};
    const notMine = { $ne: ctx.userId };
    const opts = { limit: UNREAD_CAP_PER_COLLECTION };
    const base = { spaceId: ctx.spaceId, ...range };
    const byCreatedBy = { ...base, createdBy: notMine };

    const counts = await Promise.all([
      MemoryModel.countDocuments(byCreatedBy, opts),
      LocationModel.countDocuments(byCreatedBy, opts),
      PlanItemModel.countDocuments(byCreatedBy, opts),
      TripModel.countDocuments(byCreatedBy, opts),
      TimeCapsuleModel.countDocuments({ ...base, creatorId: notMine }, opts),
      WishlistItemModel.countDocuments(byCreatedBy, opts),
      MediaItemModel.countDocuments(byCreatedBy, opts),
      RoadmapPlanModel.countDocuments(byCreatedBy, opts),
      SpecialDateModel.countDocuments(byCreatedBy, opts),
    ]);

    return { count: counts.reduce((sum, n) => sum + n, 0) };
  }),

  /** Moves this member's read watermark to now. */
  markSeen: protectedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    const now = new Date();

    // $max, not $set: two tabs marking seen out of order must never drag the
    // watermark backwards and resurrect already-read activity.
    await MemberStateModel.updateOne(
      { spaceId: ctx.spaceId, userId: ctx.userId },
      { $max: { lastSeenActivityAt: now } },
      { upsert: true },
    );

    return { lastSeenActivityAt: now };
  }),
});
