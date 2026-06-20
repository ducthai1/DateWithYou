"use client";

import { monthGridWeeks, todayKey } from "@/lib/date-keys";
import { cn } from "@/lib/utils";
import type { DaySummary } from "@/server/trpc/routers/calendar";
import { CalendarCell } from "./calendar-cell";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]; // Monday-first

export function CalendarGrid({
  year,
  month,
  summary,
  onSelectDay,
}: {
  year: number;
  month: number; // 1-12
  summary: Record<string, DaySummary>;
  onSelectDay: (dateKey: string) => void;
}) {
  const weeks = monthGridWeeks(year, month);
  const today = todayKey();

  return (
    <div>
      <div className="text-muted-foreground mb-1.5 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold md:mb-1 md:gap-1 md:font-medium">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn("py-1", i >= 5 && "text-accent/80 md:text-muted-foreground")}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 md:gap-1">
        {weeks.flat().map((cell) => (
          <CalendarCell
            key={cell.key}
            cell={cell}
            summary={summary[cell.key]}
            isToday={cell.key === today}
            onClick={() => onSelectDay(cell.key)}
          />
        ))}
      </div>
    </div>
  );
}
