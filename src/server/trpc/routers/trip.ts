import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { patchOf } from "@/server/trpc/patch-input";
import { connectToDatabase } from "@/server/db/connect";
import { TripModel } from "@/server/db/models/trip";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { tripStatus } from "@/lib/trip-status";

const tripInput = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  coverMediaId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget: z.number().min(0).default(0),
});

const checklistInput = z.object({
  content: z.string().trim().min(1).max(200),
  assigneeId: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(d: Record<string, any>) {
  return {
    id: String(d._id),
    title: d.title as string,
    description: (d.description as string) ?? null,
    coverMediaId: (d.coverMediaId as string) ?? null,
    startDate: d.startDate as string,
    endDate: d.endDate as string,
    budget: (d.budget as number) ?? 0,
    // Read off the dates every time, so a trip can never be shown in a state
    // its own calendar contradicts.
    status: tripStatus(d.startDate as string, d.endDate as string),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checklists: (d.checklists || []).map((c: any) => ({
      id: String(c._id),
      content: c.content,
      isDone: c.isDone,
      assigneeId: c.assigneeId ?? null,
    })),
  };
}

export const tripRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const trips = await TripModel.find({ spaceId: ctx.spaceId })
      .sort({ startDate: 1 })
      .lean();
    return trips.map(serialize);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const trip = await TripModel.findOne({ _id: input.id, spaceId: ctx.spaceId }).lean();
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      return serialize(trip);
    }),

  create: protectedProcedure.input(tripInput).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    const doc = await TripModel.create({
      ...input,
      spaceId: ctx.spaceId,
      createdBy: ctx.userId,
    });
    // The whole trip, like update and setStatus return. Handing back only an id
    // meant a caller reading `.status` on the result got undefined with no
    // error — the two sibling mutations answer the same question in full.
    return serialize(doc.toObject());
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(patchOf(tripInput)))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      const res = await TripModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: patch },
        { new: true }
      ).lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return serialize(res);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      /*
       * A trip made by the day planner takes its items with it.
       *
       * Items on a HAND-MADE trip are kept on purpose — each one was written
       * by a person, and losing them because the trip wrapper went would be
       * destroying work nobody asked to destroy. That is the note below, and
       * it still stands.
       *
       * A planner-made trip is the opposite: nobody wrote those items, they
       * were generated together and accepted together. Worse, the plan's
       * fingerprint lives on the trip — so deleting the trip and confirming
       * the same plan again used to insert a SECOND full set beside the first,
       * and the evening appeared twice on the calendar. `sourceKey` is what
       * tells the two kinds apart.
       */
      const doomed = await TripModel.findOne({ _id: input.id, spaceId: ctx.spaceId })
        .select("sourceKey")
        .lean<{ sourceKey?: string }>();
      const res = await TripModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      if (res.deletedCount === 0) throw new TRPCError({ code: "NOT_FOUND" });
      if (doomed?.sourceKey) {
        await PlanItemModel.deleteMany({ spaceId: ctx.spaceId, tripId: input.id });
      }
      // Items of a hand-made trip stay on the calendar, just without a parent.
      return { ok: true };
    }),

  addChecklist: protectedProcedure
    .input(z.object({ tripId: z.string() }).and(checklistInput))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await TripModel.findOneAndUpdate(
        { _id: input.tripId, spaceId: ctx.spaceId },
        {
          $push: {
            checklists: { content: input.content, assigneeId: input.assigneeId },
          },
        },
        { new: true }
      ).lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  toggleChecklist: protectedProcedure
    .input(z.object({ tripId: z.string(), checklistId: z.string(), isDone: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await TripModel.findOneAndUpdate(
        { _id: input.tripId, spaceId: ctx.spaceId, "checklists._id": input.checklistId },
        { $set: { "checklists.$.isDone": input.isDone } },
        { new: true }
      );
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  removeChecklist: protectedProcedure
    .input(z.object({ tripId: z.string(), checklistId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await TripModel.findOneAndUpdate(
        { _id: input.tripId, spaceId: ctx.spaceId },
        { $pull: { checklists: { _id: input.checklistId } } },
        { new: true }
      );
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
