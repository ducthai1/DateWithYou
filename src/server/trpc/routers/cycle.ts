import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { CycleLogModel } from "@/server/db/models/cycle-log";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
import { predictNextStart } from "@/lib/cycle-prediction";
import { todayKey } from "@/lib/date-keys";

/**
 * The quiet corner of the app.
 *
 * Space-scoped like every other feature, so both people in the couple reach the
 * same dates — but the copy built on top of it is chosen per reader, which is
 * why `get` also returns who is asking.
 *
 * Dates only ever go in and out as `YYYY-MM-DD`; the rhythm and the next
 * expected date are derived, never stored (see the model comment).
 */
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo dạng YYYY-MM-DD");

/** Nobody has a period start in the future, and none of this is about 1970. */
function isSaneStart(key: string): boolean {
  return key >= "2000-01-01" && key <= todayKey();
}

export const cycleRouter = router({
  /** The stored dates, the prediction they support, and who is reading. */
  get: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const [log, [viewer]] = await Promise.all([
      CycleLogModel.findOne({ spaceId: ctx.spaceId })
        .select("periodStarts")
        .lean<{ periodStarts?: string[] }>(),
      resolveMemberProfiles([ctx.userId]),
    ]);
    const starts = [...new Set(log?.periodStarts ?? [])].sort();
    return {
      starts,
      // Null until there are two dates to measure a rhythm between — the panel
      // says so in words rather than showing a made-up date.
      prediction: predictNextStart(starts),
      viewerGender: viewer?.gender ?? null,
    };
  }),

  /** Record one period start. Idempotent: the same day twice is one entry. */
  addStart: protectedProcedure
    .input(z.object({ date: dateKey }))
    .mutation(async ({ ctx, input }) => {
      if (!isSaneStart(input.date)) {
        return { ok: false as const, reason: "out-of-range" as const };
      }
      await connectToDatabase();
      await CycleLogModel.updateOne(
        { spaceId: ctx.spaceId },
        {
          $addToSet: { periodStarts: input.date },
          $set: { updatedBy: ctx.userId },
        },
        { upsert: true },
      );
      return { ok: true as const };
    }),

  /** Remove a mistyped entry. */
  removeStart: protectedProcedure
    .input(z.object({ date: dateKey }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await CycleLogModel.updateOne(
        { spaceId: ctx.spaceId },
        { $pull: { periodStarts: input.date }, $set: { updatedBy: ctx.userId } },
      );
      return { ok: true as const };
    }),
});
