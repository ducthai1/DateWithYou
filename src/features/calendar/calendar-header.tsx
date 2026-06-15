"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export function CalendarHeader({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number; // 1-12
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="font-serif text-2xl font-semibold">
        {MONTHS[month - 1]} <span className="text-muted-foreground">{year}</span>
      </h1>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToday}
          className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          Hôm nay
        </button>
        <button
          type="button"
          onClick={onPrev}
          aria-label="Tháng trước"
          className="text-foreground hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Tháng sau"
          className="text-foreground hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
