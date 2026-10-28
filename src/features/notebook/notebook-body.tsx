"use client";

import { useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadFailed } from "@/components/ui/load-failed";
import { useQueryString } from "@/hooks/use-query-state";
import { todayKey } from "@/lib/date-keys";
import { dayMonth, focusDay } from "@/lib/notebook";
import { weeksOf } from "@/lib/notebook-edit";
import { useNotebookActions } from "./use-notebook-actions";
import { NotebookDayCard } from "./notebook-day-card";
import { NotebookWeekPlan } from "./notebook-week-plan";
import { NotebookDaySheet } from "./notebook-day-sheet";
import { NotebookSettings } from "./notebook-settings";
import { NotebookSections } from "./notebook-sections";
import { NotebookWeightPanel } from "./notebook-weight-panel";

/**
 * One notebook: its bar (name, dates, settings), the day in view, the weigh-ins,
 * the plan week by week, and the notes.
 *
 * Polled while open, because it is shared: the other person ticking their own
 * lunch should show up here without a reload. Polling only runs in a focused
 * tab — React Query's default — so a notebook left open in the background
 * costs nothing.
 */
export function NotebookBody({
  id, switcher, onNew, onRemove,
}: {
  id: string;
  /** The notebook picker, when there is more than one. */
  switcher?: React.ReactNode;
  onNew: () => void;
  onRemove: () => void;
}) {
  const book = trpc.notebook.get.useQuery({ id }, { refetchInterval: 30_000 });
  const actions = useNotebookActions(id);
  const [today] = useState(todayKey);
  // The day in view is in the address, so a reload stays on it.
  const [dayParam, setDayParam] = useQueryString("ngay");
  const [sheet, setSheet] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);

  if (book.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  if (book.isError || !book.data)
    return <LoadFailed what="sổ này" onRetry={() => void book.refetch()} retrying={book.isFetching} />;

  const data = book.data;
  const dates = data.days.map((d) => d.date);
  const focus = focusDay(dates, today);
  const shown = dates.includes(dayParam) ? dayParam : focus;
  const weekNow = weeksOf(dates).find((w) => w.start <= today && today <= w.end);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          {switcher ?? <h2 className="text-lg font-semibold leading-snug wrap-anywhere">{data.title}</h2>}
          {dates.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {dayMonth(dates[0])} – {dayMonth(dates.at(-1)!)} · {dates.length} ngày
              {weekNow && ` · đang ở tuần ${weekNow.index}`}
            </p>
          )}
        </div>
        <Button variant="outline" className="h-10 px-3" onClick={() => setSettings(true)}>
          <Settings2 className="h-4 w-4 sm:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Tuỳ chỉnh</span>
        </Button>
        <Button variant="outline" className="h-10 px-3" onClick={onNew}>
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="sr-only sm:not-sr-only">Sổ mới</span>
        </Button>
      </Card>

      {/* Side by side from lg: the day at full width put a meal on one 1,090px line. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {shown && (
          <NotebookDayCard
            book={data}
            date={shown}
            today={today}
            actions={actions}
            onGo={(d) => setDayParam(d === focus ? "" : d)}
            onEdit={setSheet}
          />
        )}
        <NotebookWeightPanel book={data} actions={actions} />
      </div>

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="font-semibold">Kế hoạch theo tuần</h2>
          <p className="text-muted-foreground text-xs">Chạm vào một ngày để sửa cả ngày, chép hay đổi chỗ</p>
        </div>
        <NotebookWeekPlan book={data} today={today} onEdit={setSheet} />
      </Card>

      <NotebookSections book={data} actions={actions} />

      {sheet && (
        <NotebookDaySheet key={sheet} book={data} date={sheet} today={today} actions={actions} onClose={() => setSheet(null)} />
      )}
      {settings && (
        <NotebookSettings book={data} actions={actions} onRemove={onRemove} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}
