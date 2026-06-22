import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { WishlistItemModel } from "@/server/db/models/wishlist-item";
import { RewardAccountModel, RewardLogModel } from "@/server/db/models/reward-models";

const httpsUrl = z.string().url().startsWith("https://");

const wishlistInput = z.object({
  itemName: z.string().trim().min(1).max(120),
  forWhom: z.enum(["me", "partner"]).default("partner"),
  imageUrl: httpsUrl.optional(),
  sourceUrl: httpsUrl.optional(),
  price: z.number().nonnegative().optional(),
  pointCost: z.number().nonnegative().default(0).optional(),
  note: z.string().trim().max(500).optional(),
});

export const wishlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const docs = await WishlistItemModel.find({ spaceId: ctx.spaceId })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => ({
      id: String(d._id),
      itemName: d.itemName,
      forWhom: d.forWhom as "me" | "partner",
      imageUrl: d.imageUrl ?? null,
      price: d.price ?? null,
      pointCost: d.pointCost ?? 0,
      sourceUrl: d.sourceUrl ?? null,
      bought: Boolean(d.bought),
      note: d.note ?? null,
      createdAt: d.createdAt as Date,
    }));
  }),

  create: protectedProcedure
    .input(wishlistInput)
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await WishlistItemModel.create({
        ...input,
        spaceId: ctx.spaceId,
        createdBy: ctx.userId,
      });
      return { id: String(doc._id) };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(wishlistInput.partial()))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      const res = await WishlistItemModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: patch },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  toggleBought: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await WishlistItemModel.findOne({
        _id: input.id,
        spaceId: ctx.spaceId,
      }).select("bought");
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      doc.bought = !doc.bought;
      await doc.save();
      return { bought: doc.bought };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await WishlistItemModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      return { ok: true };
    }),

  redeem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await WishlistItemModel.findOne({
        _id: input.id,
        spaceId: ctx.spaceId,
      });

      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy món đồ này" });
      if (doc.bought) throw new TRPCError({ code: "BAD_REQUEST", message: "Món đồ này đã được mua rồi" });
      if (!doc.pointCost || doc.pointCost <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Món đồ này không hỗ trợ đổi bằng điểm" });

      const pointCost = doc.pointCost;

      // Deduct atomically: only succeeds when the balance still covers the cost,
      // in a single conditional update. A read-then-write here let two concurrent
      // redeems both pass the check and double-spend (or drive the balance
      // negative). Mirrors reward.redeem's atomic pattern.
      const charged = await RewardAccountModel.findOneAndUpdate(
        { spaceId: ctx.spaceId, userId: ctx.userId, balance: { $gte: pointCost } },
        { $inc: { balance: -pointCost } },
        { new: true },
      ).lean<{ balance: number }>();
      if (!charged) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bạn không đủ Phiếu bé ngoan để đổi món này!" });
      }

      // Claim the item atomically too; if another redeem won the race, refund the
      // points we just deducted so they aren't lost.
      const claimed = await WishlistItemModel.findOneAndUpdate(
        { _id: doc._id, spaceId: ctx.spaceId, bought: false },
        { $set: { bought: true } },
      )
        .select("_id")
        .lean();
      if (!claimed) {
        await RewardAccountModel.updateOne(
          { spaceId: ctx.spaceId, userId: ctx.userId },
          { $inc: { balance: pointCost } },
        );
        throw new TRPCError({ code: "BAD_REQUEST", message: "Món đồ này đã được mua rồi" });
      }

      // Log the transaction.
      await RewardLogModel.create({
        spaceId: ctx.spaceId,
        taskId: `wishlist_redeem_${doc._id}`,
        userId: ctx.userId,
        points: -pointCost,
        doneAt: new Date(),
      });

      return { success: true, remainingBalance: charged.balance };
    }),
});
