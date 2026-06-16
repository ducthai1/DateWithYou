import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { daysUntil } from "@/lib/date-keys";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const input = z.object({
  title: z.string().trim().min(1).max(80),
  date: dateKey,
  recurYearly: z.boolean().default(true),
  // Icon registry key (e.g. "calendar-heart"), not an emoji — widened from the
  // old 8-char emoji cap so multi-word lucide keys validate.
  icon: z.string().trim().max(32).optional(),
});

export const specialDateRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const docs = await SpecialDateModel.find({ spaceId: ctx.spaceId }).lean();
    return docs
      .map((d) => ({
        id: String(d._id),
        title: d.title as string,
        date: d.date as string,
        recurYearly: Boolean(d.recurYearly),
        icon: (d.icon as string) ?? null,
        daysUntil: daysUntil(d.date as string, Boolean(d.recurYearly)),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }),

  create: protectedProcedure.input(input).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    const doc = await SpecialDateModel.create({
      ...input,
      spaceId: ctx.spaceId,
      createdBy: ctx.userId,
    });
    return { id: String(doc._id) };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(input.partial()))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      const res = await SpecialDateModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: patch },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await SpecialDateModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      if (res.deletedCount === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
