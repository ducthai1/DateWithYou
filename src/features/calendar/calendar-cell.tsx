"use client";

import { cn } from "@/lib/utils";
import type { GridCell } from "@/lib/date-keys";
import type { DaySummary } from "@/server/trpc/routers/calendar";

/** One day cell in the month grid: number, memory thumbnail peek, tag dots,
 *  item count badge, special marker. Tap opens the day detail. */
export function CalendarCell({
  cell,
  summary,
  isToday,
  onClick,
}: {
  cell: GridCell;
  summary?: DaySummary;
  isToday: boolean;
  onClick: () => void;
}) {
  const dots = summary?.tagColors.slice(0, 3) ?? [];
  const count = summary?.planCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-start gap-1 overflow-hidden rounded-xl border p-1 text-sm transition-colors",
        cell.inMonth ? "bg-card border-border hover:border-accent" : "border-transparent bg-transparent text-muted-foreground/40",
        isToday && "ring-accent ring-2",
      )}
    >
      {summary?.thumbnailUrl && cell.inMonth && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={summary.thumbnailUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}

      <div className="relative flex w-full items-start justify-between">
        <span className={cn("font-medium leading-none", isToday && "text-accent")}>{cell.day}</span>
        {count > 0 && (
          <span className="bg-accent text-accent-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none">
            {count}
          </span>
        )}
      </div>

      {summary?.special && (
        <span className="relative text-xs leading-none" title={summary.special.title}>
          {summary.special.icon ?? "♥"}
        </span>
      )}

      {dots.length > 0 && (
        <div className="relative mt-auto flex items-center gap-0.5 pb-0.5">
          {dots.map((c, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
          {summary && summary.memoryCount > 0 && (
            <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-stone-400" title="Kỷ niệm" />
          )}
        </div>
      )}
    </button>
  );
}
