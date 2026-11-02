import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { patchOf } from "@/server/trpc/patch-input";
import { connectToDatabase } from "@/server/db/connect";
import { RoadmapPlanModel } from "@/server/db/models/roadmap-plan";

const statusEnum = z.enum(["idea", "planning", "done"]);

const planInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(40).optional(),
  targetDate: z.coerce.date().optional(),
  /*
   * Where the card goes, for the "+" on each column and the status row in the
   * form. On the phone that row is the only way to move a card at all — the
   * board's drag and drop is HTML5 drag, which touch screens never fire.
   * Optional with no default, so a create without it is still an idea and an
   * edit without it leaves the card where it is.
   */
  status: statusEnum.optional(),
});

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
      category: d.category ?? null,
      targetDate: d.targetDate ?? null,
      status: d.status as "idea" | "planning" | "done",
      createdAt: d.createdAt as Date,
    }));
  }),

  create: protectedProcedure
    .input(planInput)
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await RoadmapPlanModel.create({
        ...input,
        spaceId: ctx.spaceId,
        createdBy: ctx.userId,
      });
      return { id: String(doc._id) };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(patchOf(planInput)))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      const res = await RoadmapPlanModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: patch },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
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
