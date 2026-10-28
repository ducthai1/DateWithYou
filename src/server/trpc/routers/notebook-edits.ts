import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { NotebookModel } from "@/server/db/models/notebook";
import { NOTEBOOK_LIMITS as L } from "@/lib/notebook";
import {
  applyRange,
  applySlots,
  cellsForSlots,
  copyDayTo,
  swapDayContents,
  type Slot,
  type StoredDay,
} from "@/lib/notebook-edit";
import { dateKey, notFound, objectId, slotKey } from "./notebook-input";

/*
 * Reshaping a notebook after it was made — the edits chủ repo found missing
 * (28/10): its dates, its columns, its tracked number, a whole day at once,
 * copying and swapping days. The pure halves live in `@/lib/notebook-edit`.
 */

type Doc = {
  slots?: { key: string; label: string }[];
  days?: { date: string; label?: string; cells?: { slot: string; text?: string; done?: boolean }[] }[];
  updatedAt?: Date;
};

const stored = (d: Doc): { slots: Slot[]; days: StoredDay[] } => ({
  slots: (d.slots ?? []).map((s) => ({ key: s.key, label: s.label })),
  days: (d.days ?? []).map((day) => ({
    date: day.date,
    label: day.label ?? "",
    cells: (day.cells ?? []).map((c) => ({ slot: c.slot, text: c.text ?? "", done: c.done ?? false })),
  })),
});

/**
 * Read the notebook, work out the change, write it back — only if nobody wrote
 * in between. These edits replace the whole `days` list; written blind, they
 * would quietly undo the other person's tick from a second ago. On a clash the
 * change is worked out again from the fresh copy, a few times before giving up.
 */
async function rewrite(id: string, spaceId: string, change: (doc: { slots: Slot[]; days: StoredDay[] }) => Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await NotebookModel.findOne({ _id: id, spaceId }).select("slots days updatedAt").lean<Doc>();
    if (!doc) throw notFound();
    const res = await NotebookModel.updateOne({ _id: id, spaceId, updatedAt: doc.updatedAt }, { $set: change(stored(doc)) });
    if (res.matchedCount) return;
  }
  throw new TRPCError({ code: "CONFLICT", message: "BUSY" });
}

const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

export const notebookEditProcedures = {
  /** New dates for the plan: days inside kept, missing ones added, the rest dropped (the screen asks first). */
  setRange: protectedProcedure
    .input(z.object({ id: objectId, start: dateKey, end: dateKey }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await rewrite(input.id, ctx.spaceId, ({ slots, days }) => {
        const r = applyRange(days, slots.map((s) => s.key), input.start, input.end);
        if (!r) throw badRequest("BAD_RANGE");
        return { days: r.days };
      });
      return { ok: true };
    }),

  /** The columns, as the settings form leaves them: renamed, reordered, added, removed — in one go. */
  setSlots: protectedProcedure
    .input(
      z.object({
        id: objectId,
        slots: z
          .array(z.object({ key: slotKey.optional(), label: z.string().trim().min(1).max(L.slotLabel) }))
          .min(1)
          .max(L.slots),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await rewrite(input.id, ctx.spaceId, ({ slots, days }) => {
        const next = applySlots(slots, input.slots).slots;
        return { slots: next, days: cellsForSlots(days, next) };
      });
      return { ok: true };
    }),

  /** What the daily number is called and counted in — "Cân, kg", "Vòng eo, cm". */
  setMetric: protectedProcedure
    .input(
      z.object({
        id: objectId,
        label: z.string().trim().min(1).max(L.metricLabel),
        unit: z.string().trim().max(L.metricUnit),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId },
        { $set: { "metric.label": input.label, "metric.unit": input.unit } },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  /**
   * One day from the day sheet: its label and the cells that CHANGED, each on
   * its own path — the other person ticking a different meal of the same day
   * at the same moment keeps their tick.
   */
  saveDay: protectedProcedure
    .input(
      z.object({
        id: objectId,
        date: dateKey,
        label: z.string().trim().max(L.dayLabel).optional(),
        cells: z
          .array(z.object({ slot: slotKey, text: z.string().trim().max(L.cellText).optional(), done: z.boolean().optional() }))
          .max(L.slots),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const set: Record<string, unknown> = {};
      const filters: Record<string, string>[] = [{ "d.date": input.date }];
      if (input.label !== undefined) set["days.$[d].label"] = input.label;
      input.cells
        .filter((c) => c.text !== undefined || c.done !== undefined)
        .forEach((c, i) => {
          if (c.text !== undefined) set[`days.$[d].cells.$[c${i}].text`] = c.text;
          if (c.done !== undefined) set[`days.$[d].cells.$[c${i}].done`] = c.done;
          filters.push({ [`c${i}.slot`]: c.slot });
        });
      if (Object.keys(set).length === 0) return { ok: true };
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId, "days.date": input.date },
        { $set: set },
        { arrayFilters: filters },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  /** One day's plan onto other days — "the same Monday every week" — unticked. */
  copyDay: protectedProcedure
    .input(z.object({ id: objectId, from: dateKey, to: z.array(dateKey).min(1).max(L.days) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await rewrite(input.id, ctx.spaceId, ({ days }) => {
        if (!days.some((d) => d.date === input.from)) throw notFound();
        return { days: copyDayTo(days, input.from, input.to) };
      });
      return { ok: true };
    }),

  /** Two days trade places whole: label, meals and ticks. */
  swapDays: protectedProcedure
    .input(z.object({ id: objectId, a: dateKey, b: dateKey }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await rewrite(input.id, ctx.spaceId, ({ days }) => {
        if (!days.some((d) => d.date === input.a) || !days.some((d) => d.date === input.b)) throw notFound();
        return { days: swapDayContents(days, input.a, input.b) };
      });
      return { ok: true };
    }),
};
