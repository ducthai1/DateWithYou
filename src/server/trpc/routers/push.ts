import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { PushSubscriptionModel } from "@/server/db/models/push-subscription";
import { SpaceModel } from "@/server/db/models/space";
import { pushConfigured } from "@/server/lib/push";

/**
 * Registering a device for notifications.
 *
 * The browser creates the subscription — the page cannot — so all this does is
 * remember it against the person, keyed by the endpoint the browser minted.
 */
export const pushRouter = router({
  /**
   * Whether the server can send, and who is actually reachable.
   *
   * The counts are the answer to the only question anyone asks about push:
   * "why didn't it arrive?" A device that never registered and a server with no
   * keys both produce silence, and neither is visible from the phone that was
   * waiting. `partnerDevices` is here for the same reason from the other side —
   * an invite sent to someone with no registered device cannot arrive, and the
   * sender may as well be told rather than left assuming it did.
   */
  available: protectedProcedure.query(async ({ ctx }) => {
    const enabled = pushConfigured();
    if (!enabled) return { enabled, myDevices: 0, partnerDevices: 0 };
    await connectToDatabase();
    const space = await SpaceModel.findById(ctx.spaceId)
      .select("members")
      .lean<{ members: string[] }>();
    const partnerId = space?.members.find((m) => m !== ctx.userId);
    const [myDevices, partnerDevices] = await Promise.all([
      PushSubscriptionModel.countDocuments({ userId: ctx.userId }),
      partnerId ? PushSubscriptionModel.countDocuments({ userId: partnerId }) : Promise.resolve(0),
    ]);
    return { enabled, myDevices, partnerDevices };
  }),

  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(2000),
        /*
         * Sized, not just present.
         *
         * The push spec fixes these: p256dh is a 65-byte uncompressed EC point
         * and auth is 16 bytes, which land at 87-88 and 22 base64url characters.
         * A row that fails those lengths can never be delivered to — web-push
         * rejects it before a request is even made, so it would sit failing
         * forever without ever earning the 410 that prunes it.
         */
        keys: z.object({
          p256dh: z.string().min(80).max(200),
          auth: z.string().min(20).max(100),
        }),
        userAgent: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      // Upsert on the endpoint: the same device re-subscribing on every visit
      // must update its row, not add another one to push to.
      await PushSubscriptionModel.updateOne(
        { endpoint: input.endpoint },
        {
          $set: {
            userId: ctx.userId,
            spaceId: ctx.spaceId,
            keys: input.keys,
            userAgent: input.userAgent,
          },
        },
        { upsert: true },
      );
      return { ok: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      // Scoped to the caller so one person cannot unsubscribe another's device.
      await PushSubscriptionModel.deleteOne({ endpoint: input.endpoint, userId: ctx.userId });
      return { ok: true };
    }),
});
