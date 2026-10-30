import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { TrackerLinkModel } from "@/server/db/models/tracker-link";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { TrackPointModel } from "@/server/db/models/track-point";
import { trackerPassword } from "@/server/lib/tracker-token";
import { SITE_URL } from "@/lib/site";
import { ownTracksConfig, ownTracksConfigLink, type TrackerHealth } from "@/lib/owntracks";

/**
 * Linking a background tracker (OwnTracks) so a position keeps arriving with
 * the screen off. The tracker posts to /api/track/owntracks; this is only the
 * setup screen's side: link, read back what the tracker reported, unlink.
 */

type LinkRow = {
  _id: unknown;
  lastSeenAt?: Date | null;
  lastFixAt?: Date | null;
  monitoring?: number | null;
  battery?: number | null;
  health?: (TrackerHealth & { at?: Date }) | null;
  home?: { lat: number; lng: number } | null;
};

/**
 * What the screen shows. The one-tap link is rebuilt each time rather than
 * stored: its password is derived (tracker-token.ts), so "open OwnTracks again
 * to fix a permission" re-imports the very same settings instead of a new key.
 */
function view(link: LinkRow | null) {
  if (!link) return { linked: false as const };
  const id = String(link._id);
  const config = ownTracksConfig({
    url: `${SITE_URL}/api/track/owntracks`,
    username: id,
    password: trackerPassword(id),
    tid: "VV",
  });
  return {
    linked: true as const,
    configLink: ownTracksConfigLink(config),
    lastSeenAt: link.lastSeenAt ?? null,
    lastFixAt: link.lastFixAt ?? null,
    monitoring: link.monitoring ?? null,
    battery: link.battery ?? null,
    health: link.health ?? null,
    home: link.home ? { lat: link.home.lat, lng: link.home.lng } : null,
  };
}

export const trackerRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const link = await TrackerLinkModel.findOne({ spaceId: ctx.spaceId, userId: ctx.userId }).lean<LinkRow>();
    return view(link);
  }),

  /** Idempotent: linking again returns the same link, so a double tap cannot orphan a tracker. */
  connect: protectedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    const link = await TrackerLinkModel.findOneAndUpdate(
      { spaceId: ctx.spaceId, userId: ctx.userId },
      { $setOnInsert: { spaceId: ctx.spaceId, userId: ctx.userId } },
      { upsert: true, new: true },
    ).lean<LinkRow>();
    return view(link);
  }),

  /**
   * "Nhà": the circle whose crossings are told to the other person (đã về
   * nhà / vừa rời nhà). Where they stand now, or the tracker's latest fix
   * when the browser cannot get one; null clears it.
   */
  setHome: protectedProcedure
    .input(
      z.union([
        z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
        z.literal("tracker"),
        z.null(),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      let home: { lat: number; lng: number } | null = null;
      if (input === "tracker") {
        const last = await TrackPointModel.findOne({ spaceId: ctx.spaceId, userId: ctx.userId })
          .sort({ at: -1 })
          .lean<{ lat: number; lng: number }>();
        if (!last) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NO_TRACKER_FIX" });
        home = { lat: last.lat, lng: last.lng };
      } else if (input) {
        home = input;
      }
      await TrackerLinkModel.updateOne(
        { spaceId: ctx.spaceId, userId: ctx.userId },
        { $set: { home, homeFence: null } },
      );
      const link = await TrackerLinkModel.findOne({ spaceId: ctx.spaceId, userId: ctx.userId }).lean<LinkRow>();
      return view(link);
    }),

  /**
   * Revokes the tracker (its username no longer exists, so its posts are
   * refused) and takes down the position it left, so the partner stops
   * seeing a dot that will never move again.
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    await TrackerLinkModel.deleteOne({ spaceId: ctx.spaceId, userId: ctx.userId });
    await LiveLocationModel.deleteOne({ spaceId: ctx.spaceId, userId: ctx.userId, source: "tracker" });
    // Its battery reading too, left on the app's row; and the raw trail —
    // trips already made into rides stay, they are the keepsake.
    await LiveLocationModel.updateOne({ spaceId: ctx.spaceId, userId: ctx.userId }, { $set: { batteryLevel: null, batteryAt: null } });
    await TrackPointModel.deleteMany({ spaceId: ctx.spaceId, userId: ctx.userId });
    return { linked: false as const };
  }),
});
