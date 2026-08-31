import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { LocationModel } from "@/server/db/models/location";
import { SpaceModel } from "@/server/db/models/space";
import { BUCKET_KEYS, PLAN_STATUSES, BUCKET_ORDER, bucketForTime, type BucketKey } from "@/lib/plan-meta";

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
  tripId: z.string().optional(),
  cost: z.number().min(0).default(0),
});


/** Next free slot at the tail of one day+bucket. */
async function tailOrder(spaceId: string, date: string, bucket: string) {
  const last = await PlanItemModel.findOne({ spaceId, date, bucket })
    .sort({ order: -1 })
    .select("order")
    .lean<{ order?: number }>();
  return (last?.order ?? -1) + 1;
}

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
    tripId: (d.tripId as string) ?? null,
    cost: (d.cost as number) ?? 0,
  };
}

export const planItemRouter = router({
  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const docs = await PlanItemModel.find({
        spaceId: ctx.spaceId,
        tripId: input.tripId,
      }).lean();
      return docs
        .map(serialize)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
            a.order - b.order ||
            a.id.localeCompare(b.id),
        );
    }),
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
            a.order - b.order ||
            a.id.localeCompare(b.id),
        );
    }),

  create: protectedProcedure.input(itemInput).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    await assertLocationInSpace(input.locationId, ctx.spaceId);
    await assertAssigneeInSpace(input.assigneeId, ctx.spaceId);
    // A picked time decides the bucket, so the two can never contradict.
    const bucket = input.time ? bucketForTime(input.time) : input.bucket;
    const doc = await PlanItemModel.create({
      ...input,
      bucket,
      order: await tailOrder(ctx.spaceId, input.date, bucket),
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
      const current = await PlanItemModel.findOne({ _id: id, spaceId: ctx.spaceId })
        .select("date bucket time order")
        .lean<{ date: string; bucket: string; time?: string; order?: number }>();
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      // A picked time decides the bucket here too — including a time cleared to
      // empty, which hands the choice back to whatever bucket was submitted.
      const time = patch.time !== undefined ? patch.time : current.time;
      if (time) patch.bucket = bucketForTime(time);
      // Moving between buckets must re-slot: keeping the old index collides with
      // an item already holding it, and two equal orders can never be reordered.
      const date = patch.date ?? current.date;
      const bucket = patch.bucket ?? current.bucket;
      const moved = bucket !== current.bucket || date !== current.date;
      const res = await PlanItemModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: moved ? { ...patch, order: await tailOrder(ctx.spaceId, date, bucket) } : patch },
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
      // Swap by POSITION, then renumber the bucket 0..n-1.
      //
      // Comparing order values instead ($lt / $gt against a neighbour) breaks
      // the moment two items share a number: the strict comparison skips the
      // tie, so the button silently does nothing — or swaps the wrong pair and
      // spreads the duplicate. Ties are reachable from older data, so renumber
      // on every move and the bucket heals itself the first time it is touched.
      const siblings = await PlanItemModel.find({
        spaceId: ctx.spaceId,
        date: item.get("date"),
        bucket: item.get("bucket"),
      }).sort({ order: 1, _id: 1 }); // _id breaks ties the same way every read does
      const i = siblings.findIndex((d) => String(d._id) === String(item._id));
      const j = input.direction === "up" ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= siblings.length) return { ok: true }; // at the edge
      [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
      await Promise.all(
        siblings.map((d, k) => (d.get("order") === k ? null : d.set("order", k).save())),
      );
      return { ok: true };
    }),

  /*
   * Commit a whole bucket's order in one call.
   *
   * The up/down buttons move the list on screen immediately and send nothing
   * until the tapping stops, so what finally has to reach the server is the
   * order the person ended on — not the six swaps they passed through. Sending
   * the destination instead of the steps also makes a retry harmless: run it
   * twice and the bucket lands in the same place.
   */
  reorder: protectedProcedure
    .input(
      z.object({
        date: dateKey,
        bucket: bucketEnum,
        ids: z.array(z.string()).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const docs = await PlanItemModel.find({
        spaceId: ctx.spaceId,
        date: input.date,
        bucket: input.bucket,
      })
        .select("_id order")
        .lean<{ _id: unknown; order?: number }[]>();

      // Anything the client did not name keeps its relative place after the
      // ones it did — a card added by the other partner mid-drag must not be
      // dropped out of the bucket just because this client never saw it.
      const wanted = new Map(input.ids.map((id, i) => [id, i]));
      const ordered = docs
        .map((d) => ({ id: String(d._id), was: d.order ?? 0 }))
        .sort(
          (a, b) =>
            (wanted.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
              (wanted.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
            a.was - b.was ||
            a.id.localeCompare(b.id),
        );

      const writes = ordered
        .map((o, i) => ({ o, i }))
        .filter(({ o, i }) => o.was !== i)
        .map(({ o, i }) =>
          PlanItemModel.updateOne({ _id: o.id, spaceId: ctx.spaceId }, { $set: { order: i } }),
        );
      await Promise.all(writes);
      return { ok: true, changed: writes.length };
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
