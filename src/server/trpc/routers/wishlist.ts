import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { WishlistItemModel } from "@/server/db/models/wishlist-item";

const httpsUrl = z.string().url().startsWith("https://");

const wishlistInput = z.object({
  itemName: z.string().trim().min(1).max(120),
  forWhom: z.enum(["me", "partner"]).default("partner"),
  imageUrl: httpsUrl.optional(),
  sourceUrl: httpsUrl.optional(),
  price: z.number().nonnegative().optional(),
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
});
