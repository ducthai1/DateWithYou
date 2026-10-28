"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/root";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { readableFormError } from "@/lib/form-error";
import type { CellRef, NotebookCell } from "@/lib/notebook";

export type NotebookView = inferRouterOutputs<AppRouter>["notebook"]["get"];

/**
 * Every write the notebook screen makes, each one optimistic: the tick, the
 * swap, the new text show the moment they are tapped and are put back if the
 * server refuses. Waiting a round trip before a checkbox moves reads as a dead
 * checkbox — the same reason the calendar's plan cards patch their cache first.
 */
export function useNotebookActions(id: string) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const key = { id };

  const snapshot = async () => {
    await utils.notebook.get.cancel(key);
    return utils.notebook.get.getData(key);
  };
  const patch = (fn: (book: NotebookView) => NotebookView) =>
    utils.notebook.get.setData(key, (old) => (old ? fn(old) : old));
  const rollback = (prev: NotebookView | undefined, message: string) => {
    if (prev) utils.notebook.get.setData(key, prev);
    toast(readableFormError(message), "error");
  };
  const editCell = (book: NotebookView, ref: CellRef, change: Partial<NotebookCell>): NotebookView => ({
    ...book,
    days: book.days.map((d) =>
      d.date === ref.date ? { ...d, cells: { ...d.cells, [ref.slot]: { ...d.cells[ref.slot], ...change } } } : d,
    ),
  });
  const touchList = () => void utils.notebook.list.invalidate();


  const toggleCell = trpc.notebook.toggleCell.useMutation({
    onMutate: async (v) => {
      const prev = await snapshot();
      patch((b) => editCell(b, v, { done: v.done }));
      return { prev };
    },
    onError: (e, _v, ctx) => rollback(ctx?.prev, e.message),
  });



  const logReading = trpc.notebook.logReading.useMutation({
    onMutate: async (v) => {
      const prev = await snapshot();
      patch((b) => {
        const readings = b.metric.readings.filter((r) => r.date !== v.date);
        if (v.value !== null) readings.push({ date: v.date, value: v.value });
        readings.sort((x, y) => x.date.localeCompare(y.date));
        return { ...b, metric: { ...b.metric, readings } };
      });
      return { prev };
    },
    onError: (e, _v, ctx) => rollback(ctx?.prev, e.message),
  });

  // Sections and names are rarer writes with a form in front of them: no
  // optimistic copy, just refetch the notebook once the server has it.
  const refetch = () => void utils.notebook.get.invalidate(key);
  const fail = (e: { message: string }) => toast(readableFormError(e.message), "error");
  const saveSection = trpc.notebook.saveSection.useMutation({ onSuccess: refetch, onError: fail });
  const removeSection = trpc.notebook.removeSection.useMutation({ onSuccess: refetch, onError: fail });
  const rename = trpc.notebook.rename.useMutation({ onSuccess: () => { refetch(); touchList(); }, onError: fail });
  const setTargets = trpc.notebook.setTargets.useMutation({ onSuccess: refetch, onError: fail });

  /*
   * The day sheet's save: label and the cells that changed, shown at once —
   * the same reason as a tick. Reshaping (range, columns, copying days) waits
   * for the server instead: it moves whole days, and a wrong guess would show
   * days that are not there.
   */
  const saveDay = trpc.notebook.saveDay.useMutation({
    onMutate: async (v) => {
      const prev = await snapshot();
      patch((b) => ({
        ...b,
        days: b.days.map((d) => {
          if (d.date !== v.date) return d;
          const cells = { ...d.cells };
          for (const c of v.cells)
            cells[c.slot] = { ...cells[c.slot], ...(c.text !== undefined && { text: c.text.trim() }), ...(c.done !== undefined && { done: c.done }) };
          return { ...d, label: v.label !== undefined ? v.label.trim() : d.label, cells };
        }),
      }));
      return { prev };
    },
    onError: (e, _v, ctx) => rollback(ctx?.prev, e.message),
  });
  const reshaped = () => { refetch(); touchList(); };
  const setRange = trpc.notebook.setRange.useMutation({ onSuccess: reshaped, onError: fail });
  const setSlots = trpc.notebook.setSlots.useMutation({ onSuccess: refetch, onError: fail });
  const setMetric = trpc.notebook.setMetric.useMutation({ onSuccess: refetch, onError: fail });
  const copyDay = trpc.notebook.copyDay.useMutation({
    onSuccess: (_r, v) => { refetch(); toast(`Đã chép sang ${v.to.length} ngày`, "success"); },
    onError: fail,
  });
  const swapDays = trpc.notebook.swapDays.useMutation({
    onSuccess: () => { refetch(); toast("Đã đổi hai ngày cho nhau", "success"); },
    onError: fail,
  });

  return {
    toggleCell, logReading, saveSection, removeSection, rename, setTargets,
    saveDay, setRange, setSlots, setMetric, copyDay, swapDays,
  };
}

export type NotebookActions = ReturnType<typeof useNotebookActions>;
