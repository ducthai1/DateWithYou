"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

type DatePickerProps = {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
};

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const currentDate = new Date(value);
  const [viewDate, setViewDate] = useState(() => new Date(value));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

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

  // Format YYYY-MM-DD
  const formatStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleSelect = (day: number) => {
    const selected = new Date(year, month, day);
    onChange(formatStr(selected));
    setOpen(false);
  };

  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));

  // Display value for the button
  const displayVal = `${currentDate.getDate().toString().padStart(2, "0")}/${(currentDate.getMonth() + 1).toString().padStart(2, "0")}/${currentDate.getFullYear()}`;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-left font-normal bg-background hover:bg-background hover:border-accent"
        onClick={() => setOpen(!open)}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-accent" />
        {displayVal}
      </Button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          data-calendar-popup
          className="fixed z-[100] mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-xl"
          style={{
            top: (() => {
              const estimatedHeight = 320;
              return rect.bottom + estimatedHeight > window.innerHeight
                ? Math.max(0, rect.top - estimatedHeight - 8)
                : rect.bottom + 8;
            })(),
            left: Math.min(rect.left, window.innerWidth - 288 - 8),
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-accent hover:text-accent-foreground active:bg-muted transition-colors touch-manipulation" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="font-medium text-sm">
              {MONTHS[month]} năm {year}
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
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = year === currentDate.getFullYear() && month === currentDate.getMonth() && day === currentDate.getDate();
              const isToday = year === new Date().getFullYear() && month === new Date().getMonth() && day === new Date().getDate();

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={`
                    flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors touch-manipulation
                    ${isSelected
                      ? "bg-accent text-accent-foreground font-semibold active:opacity-80"
                      : isToday
                        ? "bg-accent-soft text-accent font-semibold hover:bg-accent/20 active:bg-accent/30"
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
