"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = [
  "Th1", "Th2", "Th3", "Th4", "Th5", "Th6",
  "Th7", "Th8", "Th9", "Th10", "Th11", "Th12",
];

const MONTHS_LONG = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

/**
 * Tap the month name to jump months on the mobile calendar.
 *
 * The chevrons beside it page by WEEK, which is the right step for a week strip
 * but a slow way to reach March from September — six taps at best, and the
 * label above them never explained that. So the label itself became the month
 * control: one tap opens the twelve months and the year, which also gets you
 * somewhere a stepper cannot reach quickly at all.
 */
export function CalendarMonthJump({
  selected,
  today,
  onPick,
}: {
  /** The selected day, `YYYY-MM-DD` — its month is the one shown. */
  selected: string;
  today: string;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selYear = Number(selected.slice(0, 4));
  const selMonth = Number(selected.slice(5, 7));
  // The year being browsed, which can differ from the selected one while
  // looking around; reset each time the panel opens.
  const [viewYear, setViewYear] = useState(selYear);

  const toggle = () => {
    setViewYear(selYear);
    setOpen((o) => !o);
  };

  const pick = (month: number) => {
    const mm = String(month).padStart(2, "0");
    /*
     * Land on today when jumping to the month you are already living in —
     * "Tháng 9" meaning the 1st when it is the 7th would throw away the one
     * day you most likely wanted. Any other month opens at its 1st, so the
     * week strip starts at the beginning of that month rather than mid-way.
     */
    const day = `${viewYear}-${mm}` === today.slice(0, 7) ? today.slice(8, 10) : "01";
    onPick(`${viewYear}-${mm}-${day}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${MONTHS_LONG[selMonth - 1]} ${selYear} — chọn tháng khác`}
        className="active:bg-muted -mx-2 flex touch-manipulation items-center gap-1 rounded-xl px-2 py-1 transition-colors"
      >
        {/* text-xl, not 2xl: the chevron this button adds is what tipped a
            390px-wide header into wrapping "Tháng 9" and "2026" onto two
            lines — measured in a phone-sized screenshot, not assumed. */}
        <h1 className="font-serif text-xl font-semibold whitespace-nowrap sm:text-2xl">
          {MONTHS_LONG[selMonth - 1]} <span className="text-muted-foreground">{selYear}</span>
        </h1>
        <ChevronDown
          className={cn(
            "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          {/* Tap anywhere else to dismiss. Below the panel, above the page. */}
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="border-border bg-card absolute left-0 z-40 mt-1 w-[17rem] rounded-2xl border p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label="Năm trước"
                className="text-foreground active:bg-muted inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold tabular-nums">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                aria-label="Năm sau"
                className="text-foreground active:bg-muted inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_SHORT.map((label, i) => {
                const month = i + 1;
                const isCurrent = viewYear === selYear && month === selMonth;
                const isThisMonth = `${viewYear}-${String(month).padStart(2, "0")}` === today.slice(0, 7);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => pick(month)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "touch-manipulation rounded-xl py-2 text-sm font-semibold transition-colors active:scale-95",
                      isCurrent
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : isThisMonth
                          ? "bg-accent-soft text-accent"
                          : "text-foreground active:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
