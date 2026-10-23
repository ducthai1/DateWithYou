import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { NotebookModel } from "@/server/db/models/notebook";
import { slugify } from "@/lib/slug";
import {
  METRIC_RANGE,
  NOTEBOOK_LIMITS as L,
  dayKeysBetween,
  slotKeysFor,
  type NotebookCell,
  type NotebookDay,
} from "@/lib/notebook";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slotKey = z.string().min(1).max(60);
const cellRef = z.object({ date: dateKey, slot: slotKey });
const title = z.string().trim().min(1).max(L.title);
const metricValue = z.number().gt(METRIC_RANGE.min).lt(METRIC_RANGE.max);

type Lean = {
  _id: unknown;
  title: string;
  slots?: { key: string; label: string }[];
  days?: { date: string; label?: string; cells?: { slot: string; text?: string; done?: boolean }[] }[];
  sections?: { key: string; title: string; body?: string }[];
  metric?: {
    label?: string;
    unit?: string;
    readings?: { date: string; value: number }[];
    targets?: { date: string; value: number }[];
  };
  updatedAt?: Date;
};

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

function serialize(d: Lean) {
  const slots = (d.slots ?? []).map((s) => ({ key: s.key, label: s.label }));
  const days: NotebookDay[] = (d.days ?? []).map((day) => ({
    date: day.date,
    label: day.label ?? "",
    // Every column gets a cell, even one the stored day is missing, so the
    // table never has a hole the screen has to special-case.
    cells: Object.fromEntries(
      slots.map((s): [string, NotebookCell] => {
        const c = day.cells?.find((x) => x.slot === s.key);
        return [s.key, { text: c?.text ?? "", done: c?.done ?? false }];
      }),
    ),
  }));
  return {
    id: String(d._id),
    title: d.title,
    slots,
    days: days.sort(byDate),
    sections: (d.sections ?? []).map((s) => ({ key: s.key, title: s.title, body: s.body ?? "" })),
    metric: {
      label: d.metric?.label ?? "Cân",
      unit: d.metric?.unit ?? "kg",
      readings: [...(d.metric?.readings ?? [])].sort(byDate),
      targets: [...(d.metric?.targets ?? [])].sort(byDate),
    },
    updatedAt: d.updatedAt ?? null,
  };
}

export type NotebookView = ReturnType<typeof serialize>;

const notFound = () => new TRPCError({ code: "NOT_FOUND" });

/** Filter for one cell that must exist, so a write aimed at nothing says so. */
const withCell = (id: string, spaceId: string, ref: { date: string; slot: string }) => ({
  _id: id,
  spaceId,
  days: { $elemMatch: { date: ref.date, "cells.slot": ref.slot } },
});

export const notebookRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const docs = await NotebookModel.find({ spaceId: ctx.spaceId })
      .sort({ updatedAt: -1 })
      .select("title days.date updatedAt")
      .lean<Array<{ _id: unknown; title: string; days?: { date: string }[]; updatedAt?: Date }>>();
    return docs.map((d) => {
      const dates = (d.days ?? []).map((x) => x.date).sort();
      return {
        id: String(d._id),
        title: d.title,
        start: dates[0] ?? null,
        end: dates[dates.length - 1] ?? null,
        dayCount: dates.length,
        updatedAt: d.updatedAt ?? null,
      };
    });
  }),

  get: protectedProcedure.input(z.object({ id: objectId })).query(async ({ ctx, input }) => {
    await connectToDatabase();
    const doc = await NotebookModel.findOne({ _id: input.id, spaceId: ctx.spaceId }).lean<Lean>();
    if (!doc) throw notFound();
    return serialize(doc);
  }),

  create: protectedProcedure
    .input(
      z.object({
        title,
        start: dateKey,
        end: dateKey,
        slots: z.array(z.string().trim().min(1).max(L.slotLabel)).min(1).max(L.slots),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const dates = dayKeysBetween(input.start, input.end);
      if (dates.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "BAD_RANGE" });
      const keys = slotKeysFor(input.slots);
      const doc = await NotebookModel.create({
        spaceId: ctx.spaceId,
        title: input.title,
        slots: input.slots.map((label, i) => ({ key: keys[i], label })),
        days: dates.map((date) => ({ date, label: "", cells: keys.map((slot) => ({ slot, text: "", done: false })) })),
        sections: [{ key: "ghi-chu", title: "Ghi chú", body: "" }],
        createdBy: ctx.userId,
      });
      return { id: String(doc._id) };
    }),

  rename: protectedProcedure.input(z.object({ id: objectId, title })).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    const res = await NotebookModel.updateOne({ _id: input.id, spaceId: ctx.spaceId }, { $set: { title: input.title } });
    if (!res.matchedCount) throw notFound();
    return { ok: true };
  }),

  renameSlot: protectedProcedure
    .input(z.object({ id: objectId, slot: slotKey, label: z.string().trim().min(1).max(L.slotLabel) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      // Only the label moves; cells stay filed under the key.
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId, "slots.key": input.slot },
        { $set: { "slots.$.label": input.label } },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  setCell: protectedProcedure
    .input(cellRef.extend({ id: objectId, text: z.string().trim().max(L.cellText) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await NotebookModel.updateOne(
        withCell(input.id, ctx.spaceId, input),
        { $set: { "days.$[d].cells.$[c].text": input.text } },
        { arrayFilters: [{ "d.date": input.date }, { "c.slot": input.slot }] },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  toggleCell: protectedProcedure
    .input(cellRef.extend({ id: objectId, done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await NotebookModel.updateOne(
        withCell(input.id, ctx.spaceId, input),
        { $set: { "days.$[d].cells.$[c].done": input.done } },
        { arrayFilters: [{ "d.date": input.date }, { "c.slot": input.slot }] },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  setDayLabel: protectedProcedure
    .input(z.object({ id: objectId, date: dateKey, label: z.string().trim().max(L.dayLabel) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId, "days.date": input.date },
        { $set: { "days.$.label": input.label } },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  /**
   * Exchange two cells, text and tick together — a meal moved to another day
   * carries whether it was eaten. Same day or different days, same column or not.
   */
  swapCells: protectedProcedure
    .input(z.object({ id: objectId, a: cellRef, b: cellRef }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { a, b } = input;
      const doc = await NotebookModel.findOne({ _id: input.id, spaceId: ctx.spaceId })
        .select("days")
        .lean<Pick<Lean, "days">>();
      const cellAt = (r: { date: string; slot: string }) =>
        doc?.days?.find((d) => d.date === r.date)?.cells?.find((c) => c.slot === r.slot);
      const ca = cellAt(a);
      const cb = cellAt(b);
      if (!ca || !cb) throw notFound();
      if (a.date === b.date && a.slot === b.slot) return { ok: true };
      await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId },
        {
          $set: {
            "days.$[da].cells.$[ca].text": cb.text ?? "",
            "days.$[da].cells.$[ca].done": cb.done ?? false,
            "days.$[db].cells.$[cb].text": ca.text ?? "",
            "days.$[db].cells.$[cb].done": ca.done ?? false,
          },
        },
        {
          arrayFilters: [{ "da.date": a.date }, { "ca.slot": a.slot }, { "db.date": b.date }, { "cb.slot": b.slot }],
        },
      );
      return { ok: true };
    }),

  /** Create a section (no key) or rewrite one (key). */
  saveSection: protectedProcedure
    .input(
      z.object({
        id: objectId,
        key: z.string().min(1).max(60).optional(),
        title: z.string().trim().min(1).max(L.sectionTitle),
        body: z.string().max(L.sectionBody),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      if (input.key) {
        const res = await NotebookModel.updateOne(
          { _id: input.id, spaceId: ctx.spaceId, "sections.key": input.key },
          { $set: { "sections.$.title": input.title, "sections.$.body": input.body } },
        );
        if (!res.matchedCount) throw notFound();
        return { key: input.key };
      }
      const doc = await NotebookModel.findOne({ _id: input.id, spaceId: ctx.spaceId })
        .select("sections.key")
        .lean<Pick<Lean, "sections">>();
      if (!doc) throw notFound();
      const taken = new Set((doc.sections ?? []).map((s) => s.key));
      if (taken.size >= L.sections) throw new TRPCError({ code: "BAD_REQUEST", message: "TOO_MANY_SECTIONS" });
      const base = slugify(input.title) || "muc";
      let key = base;
      for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
      // The size check rides in the filter, so two people adding at once cannot pass the cap together.
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId, [`sections.${L.sections - 1}`]: { $exists: false } },
        { $push: { sections: { key, title: input.title, body: input.body } } },
      );
      if (!res.matchedCount) throw new TRPCError({ code: "BAD_REQUEST", message: "TOO_MANY_SECTIONS" });
      return { key };
    }),

  removeSection: protectedProcedure
    .input(z.object({ id: objectId, key: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId },
        { $pull: { sections: { key: input.key } } },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  /** One reading per day: a second one that day replaces the first; `null` clears it. */
  logReading: protectedProcedure
    .input(z.object({ id: objectId, date: dateKey, value: metricValue.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const filter = { _id: input.id, spaceId: ctx.spaceId };
      const res = await NotebookModel.updateOne(filter, { $pull: { "metric.readings": { date: input.date } } });
      if (!res.matchedCount) throw notFound();
      if (input.value !== null)
        await NotebookModel.updateOne(filter, { $push: { "metric.readings": { date: input.date, value: input.value } } });
      return { ok: true };
    }),

  setTargets: protectedProcedure
    .input(
      z.object({
        id: objectId,
        targets: z.array(z.object({ date: dateKey, value: metricValue })).max(L.days),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await NotebookModel.updateOne(
        { _id: input.id, spaceId: ctx.spaceId },
        { $set: { "metric.targets": [...input.targets].sort(byDate) } },
      );
      if (!res.matchedCount) throw notFound();
      return { ok: true };
    }),

  remove: protectedProcedure.input(z.object({ id: objectId })).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    await NotebookModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
    return { ok: true };
  }),
});
