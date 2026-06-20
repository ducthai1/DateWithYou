"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayKey, weekDaysOf, addDaysKey } from "@/lib/date-keys";
import { CalendarWeekStrip } from "./calendar-week-strip";
import { CalendarDayHero } from "./calendar-day-hero";
import { DayDetail } from "./day-detail";

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

const monthOf = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) });

/**
 * Mobile-only calendar: a swipeable week strip + a rich "day hero" card. This
 * replaces the cramped month grid on phones (desktop keeps the grid). Plan and
 * memory editing is delegated to the existing DayDetail sheet, so this view owns
 * only navigation + presentation.
 */
export function CalendarWeekView() {
  const [today] = useState(todayKey);
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState(false);

  const weekDays = useMemo(() => weekDaysOf(selected), [selected]);
  // A week can straddle two months; fetch both summaries (react-query dedupes
  // when they're identical) and merge. Each is the same query key the desktop
  // grid uses, so the cache is shared.
  const mA = monthOf(weekDays[0]);
  const mB = monthOf(weekDays[6]);
  const sumA = trpc.calendar.monthSummary.useQuery(mA);
  const sumB = trpc.calendar.monthSummary.useQuery(mB);
  const summary = useMemo(
    () => ({ ...(sumA.data ?? {}), ...(sumB.data ?? {}) }),
    [sumA.data, sumB.data],
  );

  const selM = monthOf(selected);
  const shiftWeek = (dir: 1 | -1) => setSelected((s) => addDaysKey(s, dir * 7));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-serif text-2xl font-semibold">
          {MONTHS[selM.month - 1]} <span className="text-muted-foreground">{selM.year}</span>
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelected(today)}
            className="text-muted-foreground active:bg-muted touch-manipulation rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            aria-label="Tuần trước"
            className="text-foreground active:bg-muted touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            aria-label="Tuần sau"
            className="text-foreground active:bg-muted touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <CalendarWeekStrip
        weekDays={weekDays}
        selected={selected}
        today={today}
        summary={summary}
        onSelect={setSelected}
        onSwipe={shiftWeek}
      />

      <CalendarDayHero date={selected} today={today} onOpenDay={() => setEditing(true)} />

      {editing && <DayDetail date={selected} onClose={() => setEditing(false)} />}
    </div>
  );
}
