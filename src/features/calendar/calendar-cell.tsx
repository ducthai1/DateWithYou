"use client";

import { cn } from "@/lib/utils";
import type { GridCell } from "@/lib/date-keys";
import type { DaySummary } from "@/server/trpc/routers/calendar";

function getHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

const PIN_COLORS = [
  "bg-red-500 border-red-700", 
  "bg-blue-500 border-blue-700", 
  "bg-emerald-500 border-emerald-700", 
  "bg-amber-500 border-amber-700", 
  "bg-purple-500 border-purple-700"
];

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
        <div className="mt-auto w-full relative z-10 pb-1 px-0.5 flex flex-col items-center justify-end">
          {summary.plans.map((p, i) => {
            const hash = getHash(p.title + cell.key + i);
            const rotate = (hash % 16) - 8; // -8 to 8 deg
            const transX = (hash % 10) - 5; // -5 to 5 px
            const transY = i === 0 ? 0 : -((hash % 6) + 6); // -6 to -11 px overlap
            const accent = p.color || "var(--accent)";
            const pinColor = PIN_COLORS[hash % PIN_COLORS.length];

            return (
              <div
                key={i}
                className={cn(
                  "relative w-[85%] flex items-center justify-center shadow-md border border-black/10 dark:border-white/10 transition-all hover:scale-125 hover:z-50 duration-200 ease-out",
                  p.done ? "opacity-60 line-through" : "opacity-95"
                )}
                style={{ 
                  backgroundColor: accent, 
                  color: "#fff", 
                  zIndex: 10 + i,
                  borderRadius: "1px 6px 1px 6px",
                  marginTop: i === 0 ? "2px" : `${transY}px`,
                  transform: `translate(${transX}px, 0) rotate(${rotate}deg)`,
                }}
              >
                {/* Pin */}
                <div 
                   className={cn("absolute -top-[3px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] sm:w-[7px] sm:h-[7px] rounded-full shadow-sm border", pinColor)}
                   style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.3)" }}
                />
                
                {/* Text */}
                <div className="text-[9px] sm:text-[10px] font-bold leading-[1.1] truncate text-center w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] px-1 py-1">
                  {p.title}
                </div>
              </div>
            );
          })}
          {summary.planCount > 3 && (
            <div className="w-full text-[9px] text-muted-foreground text-center font-bold pt-1.5 z-0 drop-shadow-sm">
              +{summary.planCount - 3} nữa
            </div>
          )}
        </div>
      )}
    </button>
  );
}
