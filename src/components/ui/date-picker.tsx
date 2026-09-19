"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import {
  dayKey,
  parseDayKey,
  openingMonth,
  yearOptions,
  isOutOfRange,
  monthGrid,
  formatDisplay,
} from "@/lib/date-picker-range";

type DatePickerProps = {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  /**
   * Latest selectable day, `YYYY-MM-DD`. Days after it are shown but not
   * clickable — a caller that only accepts past dates should not have to catch
   * a future one after the fact and explain itself in a toast.
   */
  max?: string;
  /**
   * Shown when `value` is empty. Without it an empty value fell back to
   * today, so a birthday nobody had entered read as "born this morning".
   */
  placeholder?: string;
  /**
   * Earliest selectable day, `YYYY-MM-DD`. Also the floor of the year list.
   */
  min?: string;
  /**
   * Which month to OPEN on when there is no value yet, `YYYY-MM-DD`.
   *
   * Not a value: nothing is selected and nothing is saved until a day is
   * tapped. It only decides where the calendar starts, which for a birthday is
   * the difference between landing in the right decade and paging through
   * three hundred months. Empty value with no `defaultView` still opens on
   * today, which is right for a date near now and wrong for a date of birth.
   */
  defaultView?: string;
  /**
   * Accessible name for the trigger. A <label htmlFor> cannot point at a
   * button, so a field labelled visually beside this needs the name here or
   * the control announces itself as just a date.
   */
  ariaLabel?: string;
};

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function DatePicker({ value, onChange, max, min, defaultView, ariaLabel, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value; an empty value opens the calendar on `defaultView`
  // (or today) but selects nothing.
  const currentDate = parseDayKey(value);
  const openingDate = () => openingMonth(value, defaultView);
  const [viewDate, setViewDate] = useState(openingDate);

  /*
   * Follow the value when it arrives, and reset the view on every open.
   *
   * The view used to be read once, at mount. Settings seeds the birthday from
   * a query, so the field mounted empty and the date landed a moment later —
   * and the calendar stayed on the month it had opened with, which was the
   * current one. Opening it showed today while the button underneath said
   * 1998. Re-syncing on open also means a picker that was left on some other
   * month is back where it belongs the next time it is used.
   */
  useEffect(() => {
    if (open) setViewDate(openingDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, defaultView]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { daysInMonth, firstWeekday } = monthGrid(year, month);

  const [rect, setRect] = useState<DOMRect | null>(null);

  // Close on outside click / scroll / resize / Escape. The popup is fixed-position
  // anchored to a one-time rect, so on scroll OR resize (mobile rotation, soft
  // keyboard) it would otherwise float detached from the trigger — close instead.
  useEffect(() => {
    if (!open) return; // symmetric add/remove: only bind while open
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-calendar-popup]")) return; // clicks inside the popup
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onScroll(e: Event) {
      const target = e.target as HTMLElement;
      if (target.closest && target.closest("[data-calendar-popup]")) return;
      setOpen(false);
    }
    const onResize = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };

    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = (day: number) => {
    onChange(dayKey(new Date(year, month, day)));
    setOpen(false);
  };

  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));

  /*
   * The year list, and why it is bounded by the same props as the days.
   *
   * A birthday passes `max` = today and reaches back a century; a trip passes
   * neither and wants the next few years. Deriving both ends from `min`/`max`
   * means one list that is never wrong for the caller, instead of a fixed
   * range that is always wrong for someone.
   */
  const years = yearOptions({ min, max, viewYear: year });

  /** Clamp the day too: jumping to a month shorter than the current day
   *  (31 Jan → Feb) must not roll the view into the month after. */
  const goTo = (y: number, m: number) => setViewDate(new Date(y, m, 1));

  // Display value for the button
  const displayVal = formatDisplay(value, placeholder ?? "Chọn ngày");

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        /*
         * The chosen date is stated in the foreground colour, at medium weight.
         *
         * The outline variant sets no text colour, so the date inherited the
         * muted grey of whatever surrounded it and read as a disabled field —
         * people assumed the date could not be changed and did not try, even
         * though tapping it has always opened the picker.
         *
         * Fixing the text was only half of it: the fill stayed on `background`,
         * the page's off-white, which inside a white card is still the grey box
         * that says "not for you". It sits on the card colour now, like every
         * other field.
         */
        className={`bg-card hover:bg-card w-full justify-start text-left font-medium hover:border-accent ${value ? "text-foreground" : "text-muted-foreground"}`}
        aria-label={ariaLabel}
        onClick={() => setOpen(!open)}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-accent-ink" />
        {displayVal}
      </Button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          data-calendar-popup
          className="fixed z-[100] mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-xl"
          style={{
            top: (() => {
              const estimatedHeight = 320;
              return rect.bottom + estimatedHeight > window.innerHeight
                ? Math.max(0, rect.top - estimatedHeight - 8)
                : rect.bottom + 8;
            })(),
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 320 - 8)),
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-accent hover:text-accent-foreground active:bg-muted transition-colors touch-manipulation" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            {/* Two selects, not a label. Native on purpose: on a phone this
                opens the platform wheel, and typing "1998" in the year list
                jumps straight there — the arrows either side stay for the
                ±1 month case they are good at. */}
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
              <select
                aria-label="Tháng"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground"
                value={month}
                onChange={(e) => goTo(year, Number(e.target.value))}
              >
                {MONTHS.map((label, i) => (
                  <option key={label} value={i}>{label}</option>
                ))}
              </select>
              <select
                aria-label="Năm"
                className="h-9 w-[5.5rem] shrink-0 rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground"
                value={year}
                onChange={(e) => goTo(Number(e.target.value), month)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-accent hover:text-accent-foreground active:bg-muted transition-colors touch-manipulation" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {DAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = !!currentDate && year === currentDate.getFullYear() && month === currentDate.getMonth() && day === currentDate.getDate();
              const isToday = year === new Date().getFullYear() && month === new Date().getMonth() && day === new Date().getDate();
              // Compared as day keys, so no timezone enters into it.
              const key = dayKey(new Date(year, month, day));
              const disabled = isOutOfRange(key, { min, max });

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelect(day)}
                  className={`
                    flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors touch-manipulation
                    ${disabled
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : isSelected
                      ? "bg-accent text-accent-foreground font-semibold active:opacity-80"
                      : isToday
                        ? "bg-accent-soft text-accent-ink font-semibold hover:bg-accent/20 active:bg-accent/30"
                        : "hover:bg-muted active:bg-muted text-foreground"
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
