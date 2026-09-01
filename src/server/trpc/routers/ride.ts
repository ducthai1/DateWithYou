import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { RideModel } from "@/server/db/models/ride";

/**
 * Ride history — one document per finished motorbike trip, written once by
 * `ride.record` when live navigation ends. Unlike `activity.feed` this is not
 * derived: a ride has no other collection to read back from once the
 * live-navigation session that produced it is gone.
 */

// [lng, lat], matching the coordinate order the routing engine and the
// live-navigation hook already use. Range-checked so a garbled GPS fix (NaN,
// or a swapped lat/lng pair) fails validation instead of drawing a route line
// across the wrong hemisphere.
const pointSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

/** A saved-place id is a Mongo ObjectId hex string; anything else is not one. */
const objectIdString = z.string().trim().regex(/^[0-9a-fA-F]{24}$/);

const MAX_PATH_POINTS = 2000;

/**
 * Evenly samples a path down to `max` points instead of truncating it.
 *
 * Truncating from one end would cut a cross-town ride in half on the map —
 * the point that matters most (the destination) is the one at the far end. A
 * ride recorded with a breadcrumb every few seconds can legitimately carry
 * more than 2000 points; sampling keeps its overall shape (including the
 * exact start and end) instead of rejecting a longer ride outright or lying
 * about where it went.
 */
function samplePath(points: [number, number][], max: number): [number, number][] {
  if (points.length <= max) return points;
  if (max <= 1) return points.slice(0, max);
  const step = (points.length - 1) / (max - 1);
  const sampled: [number, number][] = [];
  for (let i = 0; i < max; i++) {
    sampled.push(points[Math.round(i * step)]);
  }
  return sampled;
}

const recordInput = z
  .object({
    destinationName: z.string().trim().min(1).max(120),
    destinationLocationId: objectIdString.optional(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    // Generous upper bounds — more than a round trip across Vietnam, and more
    // than a two-day ride — so they guard against a corrupt payload (a bad
    // GPS delta multiplying into billions of metres, a stuck clock producing
    // an epoch-adjacent timestamp) rather than against real long rides.
    distanceMeters: z.number().min(0).max(2_000_000),
    durationSeconds: z.number().min(0).max(2 * 24 * 60 * 60),
    // Capped well above MAX_PATH_POINTS: this is the raw breadcrumb trail
    // before sampling, recorded every few seconds, so a long ride's raw count
    // can exceed 2000 on its own. The cap exists to bound payload size, not
    // to reject legitimately long rides — samplePath() does the down-sizing.
    path: z.array(pointSchema).max(20_000).default([]),
    companion: z.boolean().default(false),
  })
  .refine((data) => data.endedAt >= data.startedAt, {
    message: "endedAt must not be before startedAt",
    path: ["endedAt"],
  });

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(30),
  /** Keyset pagination: only rides that ended strictly before this instant. */
  before: z.coerce.date().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(d: Record<string, any>) {
  return {
    id: String(d._id),
    userId: d.userId as string,
    destinationName: d.destinationName as string,
    destinationLocationId: (d.destinationLocationId as string) ?? null,
    startedAt: d.startedAt as Date,
    endedAt: d.endedAt as Date,
    distanceMeters: d.distanceMeters as number,
    durationSeconds: d.durationSeconds as number,
    companion: Boolean(d.companion),
  };
}

export const rideRouter = router({
  /** Records one finished ride. Called once, when live navigation ends. */
  record: protectedProcedure.input(recordInput).mutation(async ({ ctx, input }) => {
    await connectToDatabase();

    const doc = await RideModel.create({
      spaceId: ctx.spaceId,
      userId: ctx.userId,
      destinationName: input.destinationName,
      destinationLocationId: input.destinationLocationId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      path: samplePath(input.path, MAX_PATH_POINTS),
      companion: input.companion,
    });

    return { id: String(doc._id) };
  }),

  /** Newest-first, keyset-paginated — mirrors `activity.feed`'s shape. */
  list: protectedProcedure.input(listInput.optional()).query(async ({ ctx, input }) => {
    await connectToDatabase();

    const limit = input?.limit ?? 30;
    const before = input?.before;
    const base = {
      spaceId: ctx.spaceId,
      ...(before ? { endedAt: { $lt: before } } : {}),
    };

    // One extra row tells us whether a next page exists without a second
    // round-trip (a count query) or an approximate "items.length === limit"
    // guess that is wrong exactly when the space has precisely `limit` rides.
    const rows = await RideModel.find(base)
      .select(
        "_id userId destinationName destinationLocationId startedAt endedAt distanceMeters durationSeconds companion",
      )
      .sort({ endedAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map(serialize),
      nextCursor: hasMore ? page[page.length - 1]!.endedAt : null,
    };
  }),

  /** Space-wide totals for the summary header — rides, distance, duration. */
  stats: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();

    const [totals] = await RideModel.aggregate<{
      count: number;
      distanceMeters: number;
      durationSeconds: number;
    }>([
      { $match: { spaceId: ctx.spaceId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          distanceMeters: { $sum: "$distanceMeters" },
          durationSeconds: { $sum: "$durationSeconds" },
        },
      },
    ]);

    return {
      count: totals?.count ?? 0,
      distanceMeters: totals?.distanceMeters ?? 0,
      durationSeconds: totals?.durationSeconds ?? 0,
    };
  }),
});
