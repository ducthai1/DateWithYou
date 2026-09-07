import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { SpaceModel } from "@/server/db/models/space";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
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
  myBirthday: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const doc = await SpecialDateModel.findOne({
      spaceId: ctx.spaceId,
      birthdayOf: ctx.userId,
    })
      .select("date")
      .lean<{ date?: string }>();
    return { date: doc?.date ?? null };
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
      if (!input.date) {
        await SpecialDateModel.deleteOne({ spaceId: ctx.spaceId, birthdayOf: ctx.userId });
        return { ok: true as const };
      }
      // Nobody is born tomorrow. Guards a typo'd year landing a "birthday"
      // decades out, which would then sit at the top of the countdown.
      if (input.date > todayKey()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ngày sinh không thể ở tương lai" });
      }
      /*
       * The name rides in the title so two people's birthdays are tellable
       * apart on the calendar. Rewritten on every save, so if a nickname
       * changes, re-saving the date refreshes it.
       */
      const [me] = await resolveMemberProfiles([ctx.userId]);
      const space = await SpaceModel.findById(ctx.spaceId)
        .select("memberProfiles")
        .lean<{ memberProfiles?: { userId: string; nickname?: string }[] }>();
      const nickname = (space?.memberProfiles ?? []).find((p) => p.userId === ctx.userId)?.nickname;
      const who = nickname || me?.name || "bạn";
      await SpecialDateModel.updateOne(
        { spaceId: ctx.spaceId, birthdayOf: ctx.userId },
        {
          $set: {
            title: `Sinh nhật ${who}`,
            date: input.date,
            recurYearly: true,
            icon: "cake",
          },
          $setOnInsert: { spaceId: ctx.spaceId, birthdayOf: ctx.userId, createdBy: ctx.userId },
        },
        { upsert: true },
      );
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
