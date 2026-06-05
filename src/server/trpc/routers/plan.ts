import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { RoadmapPlanModel } from "@/server/db/models/roadmap-plan";

const statusEnum = z.enum(["idea", "planning", "done"]);

export const planRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const docs = await RoadmapPlanModel.find({ spaceId: ctx.spaceId })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      description: d.description ?? null,
      targetDate: d.targetDate ?? null,
      status: d.status as "idea" | "planning" | "done",
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional(),
        targetDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await RoadmapPlanModel.create({
        ...input,
        spaceId: ctx.spaceId,
        createdBy: ctx.userId,
      });
      return { id: String(doc._id) };
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: statusEnum }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await RoadmapPlanModel.findOneAndUpdate(
        { _id: input.id, spaceId: ctx.spaceId },
        { $set: { status: input.status } },
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
      await RoadmapPlanModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      return { ok: true };
    }),
});
