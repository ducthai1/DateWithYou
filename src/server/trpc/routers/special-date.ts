import { z } from "zod";
import { readUserBirthday, setUserBirthday } from "@/server/lib/birthday-sync";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { patchOf } from "@/server/trpc/patch-input";
import { connectToDatabase } from "@/server/db/connect";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { daysUntil, todayKey } from "@/lib/date-keys";

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

  /** Your own birthday — the one row in this space tagged to you. */
  /*
   * Off the account, not off this space's row — so a space you just joined
   * already knows your birthday before its row has been written.
   */
  myBirthday: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    return { date: await readUserBirthday(ctx.userId) };
  }),

  /**
   * Set, or clear, your own birthday. Only ever your own.
   *
   * Written as an ordinary recurring special date on purpose: the countdown,
   * the calendar grid and /home already read those, so this needs no new
   * plumbing and inherits the Feb-29 clamping in `daysUntil`. `birthdayOf` is
   * what makes a second save an update rather than a duplicate row.
   */
  setMyBirthday: protectedProcedure
    .input(z.object({ date: dateKey.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      // Nobody is born tomorrow. Guards a typo'd year landing a "birthday"
      // decades out, which would then sit at the top of the countdown.
      if (input.date && input.date > todayKey()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ngày sinh không thể ở tương lai" });
      }
      // One fact about the person; a calendar row in every space they are in.
      await setUserBirthday(ctx.userId, input.date);
      return { ok: true as const };
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
    .input(z.object({ id: z.string() }).and(patchOf(input)))
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
