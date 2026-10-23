"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayKey, weekDaysOf, addDaysKey } from "@/lib/date-keys";
import { CalendarWeekStrip } from "./calendar-week-strip";
import { CalendarMonthJump } from "./calendar-month-jump";
import { CalendarDayHero } from "./calendar-day-hero";
import { replaceQuery, useQueryParam } from "@/hooks/use-query-state";
import { dayParam } from "@/lib/url-query";

const monthOf = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) });

/**
 * Mobile-only calendar: a swipeable week strip + a rich "day hero" card. This
 * replaces the cramped month grid on phones (desktop keeps the grid). Plan and
 * memory editing is delegated to the existing DayDetail sheet, so this view owns
 * only navigation + presentation.
 */
export function CalendarWeekView() {
  const [today] = useState(todayKey);
  /*
   * The picked day is `?day=` and the open day sheet is CalendarView's `?d=`,
   * so a reload comes back to the same week, the same day and the same open
   * sheet. In React state the strip always returned to today, sheet closed.
   */
  const selected = dayParam(useQueryParam("day")) ?? today;
  const setSelected = (day: string) => replaceQuery({ day: day === today ? null : day });

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

  const shiftWeek = (dir: 1 | -1) => setSelected(addDaysKey(selected, dir * 7));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {/* The month name is the month control; the chevrons stay on weeks,
            which is the step the strip beside them actually shows. */}
        <CalendarMonthJump selected={selected} today={today} onPick={setSelected} />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSelected(today)}
            className="text-muted-foreground active:bg-muted touch-manipulation rounded-lg px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
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

      {/* CalendarView renders the sheet for `?d=`, on phones as on desktop. */}
      <CalendarDayHero date={selected} today={today} onOpenDay={() => replaceQuery({ d: selected })} />
    </div>
  );
}
