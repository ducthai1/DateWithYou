"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { LoadFailed } from "@/components/ui/load-failed";
import { todayKey } from "@/lib/date-keys";
import { NOTEBOOK_LIMITS, dayMonth, focusDay, type CellRef } from "@/lib/notebook";
import { useNotebookActions } from "./use-notebook-actions";
import { NotebookTodayCard } from "./notebook-today-card";
import { NotebookPlanTable } from "./notebook-plan-table";
import { NotebookCellSheet } from "./notebook-cell-sheet";
import { NotebookSections } from "./notebook-sections";
import { NotebookWeightPanel } from "./notebook-weight-panel";
import { NotebookTextPrompt } from "./notebook-text-prompt";

/**
 * One notebook: today on top, then the plan, the weigh-ins and the notes.
 *
 * Polled while open, because it is shared: the other person ticking their own
 * lunch should show up here without a reload. Polling only runs in a focused
 * tab — React Query's default — so a notebook left open in the background
 * costs nothing.
 */
export function NotebookBody({ id }: { id: string }) {
  const book = trpc.notebook.get.useQuery({ id }, { refetchInterval: 30_000 });
  const actions = useNotebookActions(id);
  const [today] = useState(todayKey);
  const [openCell, setOpenCell] = useState<CellRef | null>(null);
  const [swapFrom, setSwapFrom] = useState<CellRef | null>(null);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [editSlot, setEditSlot] = useState<string | null>(null);

  if (book.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  if (book.isError || !book.data)
    return <LoadFailed what="sổ này" onRetry={() => void book.refetch()} retrying={book.isFetching} />;

  const data = book.data;
  const focus = focusDay(data.days.map((d) => d.date), today);
  const slotBeingRenamed = data.slots.find((s) => s.key === editSlot);
  const dayBeingLabelled = data.days.find((d) => d.date === editDay);

  return (
    <div className="space-y-4">
      {/* Side by side from lg: the today card at full width put a meal on one
          1,090px line, which nobody reads. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {focus && (
          <NotebookTodayCard book={data} date={focus} today={today} actions={actions} onOpenCell={setOpenCell} />
        )}
        <NotebookWeightPanel book={data} actions={actions} />
      </div>

      <Card className="space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold">
          Cả đợt{" "}
          {data.days.length > 0 && (
            <span className="text-muted-foreground font-normal">
              {dayMonth(data.days[0].date)} – {dayMonth(data.days.at(-1)!.date)}
            </span>
          )}
        </h2>
        <NotebookPlanTable
          book={data}
          today={today}
          swapFrom={swapFrom}
          onOpenCell={setOpenCell}
          onPickSwap={(ref) => {
            if (swapFrom) actions.swap.mutate({ id, a: swapFrom, b: ref });
            setSwapFrom(null);
          }}
          onCancelSwap={() => setSwapFrom(null)}
          onEditDay={setEditDay}
          onEditSlot={setEditSlot}
        />
      </Card>

      <NotebookSections book={data} actions={actions} />

      {openCell && (
        <NotebookCellSheet
          key={`${openCell.date}:${openCell.slot}`}
          book={data}
          cellRef={openCell}
          actions={actions}
          onStartSwap={(ref) => {
            setOpenCell(null);
            setSwapFrom(ref);
          }}
          onClose={() => setOpenCell(null)}
        />
      )}
      {dayBeingLabelled && (
        <NotebookTextPrompt
          title={`Nhãn ngày ${dayMonth(dayBeingLabelled.date)}`}
          label="Nhãn"
          placeholder="Vd: tập C, cầu lông, nghỉ"
          initial={dayBeingLabelled.label}
          maxLength={NOTEBOOK_LIMITS.dayLabel}
          allowEmpty
          onSave={(label) => actions.setDayLabel.mutate({ id, date: dayBeingLabelled.date, label })}
          onClose={() => setEditDay(null)}
        />
      )}
      {slotBeingRenamed && (
        <NotebookTextPrompt
          title="Đổi tên cột"
          label="Tên cột"
          initial={slotBeingRenamed.label}
          maxLength={NOTEBOOK_LIMITS.slotLabel}
          onSave={(label) => actions.renameSlot.mutate({ id, slot: slotBeingRenamed.key, label })}
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  );
}
