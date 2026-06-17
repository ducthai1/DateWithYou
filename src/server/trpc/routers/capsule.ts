import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { TimeCapsuleModel } from "@/server/db/models/time-capsule";
import { TRPCError } from "@trpc/server";

export const capsuleRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const capsules = await TimeCapsuleModel.find({ spaceId: ctx.spaceId })
      .sort({ unlockDate: 1 }) // Soonest to unlock first
      .lean<{
        _id: unknown;
        creatorId: string;
        title: string;
        message: string;
        mediaUrls: string[];
        unlockDate: Date;
        isOpened: boolean;
        createdAt: Date;
      }[]>();

    const now = new Date();

    return capsules.map((c) => {
      const isLocked = new Date(c.unlockDate) > now;
      
      return {
        id: String(c._id),
        creatorId: c.creatorId,
        title: c.title,
        unlockDate: c.unlockDate,
        isOpened: c.isOpened,
        createdAt: c.createdAt,
        // SECURITY: If it's still locked, strip the secret content entirely
        // so it cannot be inspected in DevTools/Network tab.
        message: isLocked ? null : c.message,
        mediaUrls: isLocked ? [] : c.mediaUrls,
        isLocked,
      };
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(100),
        message: z.string().trim().min(1),
        unlockDate: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      
      // Ensure unlockDate is in the future
      if (input.unlockDate <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ngày mở khoá phải ở trong tương lai.",
        });
      }

      const doc = await TimeCapsuleModel.create({
        spaceId: ctx.spaceId,
        creatorId: ctx.userId,
        title: input.title,
        message: input.message,
        unlockDate: input.unlockDate,
        isOpened: false,
      });

      return { id: String(doc._id) };
    }),

  markOpened: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      
      const capsule = await TimeCapsuleModel.findOne({
        _id: input.id,
        spaceId: ctx.spaceId,
      });

      if (!capsule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy hộp thời gian" });
      }

      if (capsule.unlockDate > new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chưa đến thời gian mở khoá!" });
      }

      capsule.isOpened = true;
      await capsule.save();

      return { success: true };
    }),
});
