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
  const count = summary?.planCount ?? 0;
  const hasPlans = summary?.plans && summary.plans.length > 0;

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

      <div className="relative flex w-full items-start justify-between z-10">
        <div className="flex items-center gap-1">
          <span className={cn("font-medium leading-none", isToday && "text-accent")}>{cell.day}</span>
          {summary && summary.memoryCount > 0 && !summary.thumbnailUrl && (
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400" title="Kỷ niệm" />
          )}
        </div>
        {count > 0 && (
          <span className="bg-accent text-accent-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none shadow-sm">
            {count}
          </span>
        )}
      </div>

      {summary?.special && (
        <div className="w-full truncate rounded bg-pink-500/15 px-1 py-0.5 text-[9px] sm:text-[10px] font-semibold text-pink-700 dark:text-pink-300 z-10 text-left mb-0.5 shadow-sm">
          {summary.special.icon && <span className="mr-0.5">{summary.special.icon}</span>}
          {summary.special.title}
        </div>
      )}

      {hasPlans && (
        <div className="mt-auto w-full space-y-[2px] z-10">
          {summary.plans.map((p, i) => (
            <div
              key={i}
              className={cn(
                "w-full truncate rounded-[3px] px-1 py-[2px] text-[9px] sm:text-[10px] font-medium leading-[1.1] shadow-sm text-left transition-opacity",
                p.done ? "opacity-50 line-through" : "opacity-95 hover:opacity-100",
                !p.color && "bg-accent/80 text-accent-foreground"
              )}
              style={p.color ? { backgroundColor: p.color, color: "#fff" } : undefined}
            >
              {p.title}
            </div>
          ))}
          {summary.planCount > 3 && (
            <div className="w-full text-[9px] text-muted-foreground text-center font-medium leading-none pt-0.5">
              +{summary.planCount - 3}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
