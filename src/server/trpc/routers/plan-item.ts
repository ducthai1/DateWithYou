import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { LocationModel } from "@/server/db/models/location";
import { SpaceModel } from "@/server/db/models/space";
import { BUCKET_KEYS, PLAN_STATUSES, BUCKET_ORDER, type BucketKey } from "@/lib/plan-meta";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bucketEnum = z.enum(BUCKET_KEYS as [BucketKey, ...BucketKey[]]);
const statusEnum = z.enum([...PLAN_STATUSES] as [string, ...string[]]);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// FK guard: a referenced location must belong to the caller's space.
async function assertLocationInSpace(locationId: string | undefined, spaceId: string) {
  if (!locationId) return;
  const loc = await LocationModel.findOne({ _id: locationId, spaceId }).select("_id").lean();
  if (!loc) throw new TRPCError({ code: "BAD_REQUEST", message: "BAD_LOCATION" });
}

// FK guard: an assignee must be a member of the caller's space.
async function assertAssigneeInSpace(assigneeId: string | undefined, spaceId: string) {
  if (!assigneeId) return;
  const space = await SpaceModel.findOne({ _id: spaceId, members: assigneeId })
    .select("_id")
    .lean();
  if (!space) throw new TRPCError({ code: "BAD_REQUEST", message: "BAD_ASSIGNEE" });
}

const itemInput = z.object({
  title: z.string().trim().min(1).max(160),
  note: z.string().trim().max(1000).optional(),
  date: dateKey,
  bucket: bucketEnum,
  time: timeStr.optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  assigneeId: z.string().optional(),
  locationId: z.string().optional(),
  mediaId: z.string().optional(),
});

function serialize(d: Record<string, unknown>) {
  return {
    id: String(d._id),
    title: d.title as string,
    note: (d.note as string) ?? null,
    date: d.date as string,
    bucket: d.bucket as BucketKey,
    time: (d.time as string) ?? null,
    order: (d.order as number) ?? 0,
    tags: (d.tags as string[]) ?? [],
    status: d.status as string,
    assigneeId: (d.assigneeId as string) ?? null,
    locationId: (d.locationId as string) ?? null,
    mediaId: (d.mediaId as string) ?? null,
  };
}

export const planItemRouter = router({
  // Items across a day range (inclusive of fromKey, exclusive of toKey), sorted
  // by day → bucket → order. Powers the day detail and the agenda view.
  listByRange: protectedProcedure
    .input(z.object({ fromKey: dateKey, toKey: dateKey }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const docs = await PlanItemModel.find({
        spaceId: ctx.spaceId,
        date: { $gte: input.fromKey, $lt: input.toKey },
      }).lean();
      return docs
        .map(serialize)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
            a.order - b.order,
        );
    }),

  create: protectedProcedure.input(itemInput).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    await assertLocationInSpace(input.locationId, ctx.spaceId);
    await assertAssigneeInSpace(input.assigneeId, ctx.spaceId);
    // Append to the end of its bucket for the day.
    const last = await PlanItemModel.findOne({
      spaceId: ctx.spaceId,
      date: input.date,
      bucket: input.bucket,
    })
      .sort({ order: -1 })
      .select("order")
      .lean<{ order?: number }>();
    const doc = await PlanItemModel.create({
      ...input,
      order: (last?.order ?? -1) + 1,
      spaceId: ctx.spaceId,
      createdBy: ctx.userId,
    });
    return { id: String(doc._id) };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(itemInput.partial()))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      await assertLocationInSpace(patch.locationId, ctx.spaceId);
      await assertAssigneeInSpace(patch.assigneeId, ctx.spaceId);
      const res = await PlanItemModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: patch },
        { new: true },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: statusEnum }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await PlanItemModel.findOneAndUpdate(
        { _id: input.id, spaceId: ctx.spaceId },
        { $set: { status: input.status } },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  // Swap order with the adjacent item in the same day+bucket (up/down buttons).
  move: protectedProcedure
    .input(z.object({ id: z.string(), direction: z.enum(["up", "down"]) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const item = await PlanItemModel.findOne({ _id: input.id, spaceId: ctx.spaceId });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const dir = input.direction === "up" ? -1 : 1;
      const neighbour = await PlanItemModel.find({
        spaceId: ctx.spaceId,
        date: item.get("date"),
        bucket: item.get("bucket"),
        order: dir === -1 ? { $lt: item.get("order") } : { $gt: item.get("order") },
      })
        .sort({ order: dir === -1 ? -1 : 1 })
        .limit(1);
      const other = neighbour[0];
      if (!other) return { ok: true }; // already at the edge
      const a = item.get("order");
      item.set("order", other.get("order"));
      other.set("order", a);
      await Promise.all([item.save(), other.save()]);
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await PlanItemModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      if (res.deletedCount === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
