import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { PushSubscriptionModel } from "@/server/db/models/push-subscription";
import { pushConfigured } from "@/server/lib/push";

/**
 * Registering a device for notifications.
 *
 * The browser creates the subscription — the page cannot — so all this does is
 * remember it against the person, keyed by the endpoint the browser minted.
 */
export const pushRouter = router({
  /** Whether the server can send at all, so the UI can hide a dead switch. */
  available: protectedProcedure.query(() => ({ enabled: pushConfigured() })),

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
