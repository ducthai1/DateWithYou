import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { ErrorLogModel } from "@/server/db/models/error-log";

/**
 * Looking at what is failing.
 *
 * The one screen behind this answers a question the app previously had no way
 * to answer at all: is anything broken right now, and for how many people.
 * Admin-only, because a stack trace names files and line numbers.
 */
export const opsRouter = router({
  errors: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      await connectToDatabase();
      const rows = await ErrorLogModel.find({})
        .sort({ lastAt: -1 })
        .limit(input?.limit ?? 50)
        .lean<
          Array<{
            _id: unknown; where: string; message: string; stack?: string;
            count: number; firstAt: Date; lastAt: Date; spaceId?: string;
          }>
        >();
      return rows.map((r) => ({
        id: String(r._id),
        where: r.where,
        message: r.message,
        stack: r.stack ?? null,
        count: r.count,
        firstAt: r.firstAt,
        lastAt: r.lastAt,
        spaceId: r.spaceId ?? null,
      }));
    }),

  /** Mark one as dealt with. It comes back if it happens again. */
  dismissError: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await connectToDatabase();
      await ErrorLogModel.deleteOne({ _id: input.id });
      return { id: input.id };
    }),
});
