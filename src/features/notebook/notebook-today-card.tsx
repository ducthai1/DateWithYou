"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayMonth, dayProgress, formatReading, parseReading, weekdayLong, type CellRef } from "@/lib/notebook";
import { NotebookCheck } from "./notebook-check";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

/**
 * The top of the screen: what today asks for, as a checklist, and the morning
 * weigh-in. The rest of the plan is the table below — this card is the part
 * opened every day, so it gets the room.
 */
export function NotebookTodayCard({
  book,
  date,
  today,
  actions,
  onOpenCell,
}: {
  book: NotebookView;
  /** The day shown: today while the plan runs, else its nearest end. */
  date: string;
  today: string;
  actions: NotebookActions;
  onOpenCell: (ref: CellRef) => void;
}) {
  const day = book.days.find((d) => d.date === date);
  if (!day) return null;
  const isToday = date === today;
  const { done, total } = dayProgress(day);

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold leading-snug">
          <span className="text-accent-ink">{isToday ? "Hôm nay" : date < today ? "Ngày cuối đợt" : "Ngày đầu đợt"}</span>
          {" · "}
          {weekdayLong(date)} {dayMonth(date)}
        </h2>
        {total > 0 && (
          <span className="text-muted-foreground text-sm tabular-nums">
            Xong {done}/{total}
          </span>
        )}
      </div>
      {day.label && <p className="text-muted-foreground -mt-2 text-sm wrap-anywhere">{day.label}</p>}

      <ul className="divide-border divide-y">
        {book.slots.map((slot) => {
          const cell = day.cells[slot.key];
          const empty = cell.text.trim() === "";
          return (
            <li key={slot.key} className="flex items-start gap-1 py-1.5">
              <NotebookCheck
                done={cell.done}
                disabled={empty}
                label={`${slot.label}: ${empty ? "chưa ghi gì" : cell.text}`}
                onToggle={() => actions.toggleCell.mutate({ id: book.id, date, slot: slot.key, done: !cell.done })}
              />
              <button
                type="button"
                onClick={() => onOpenCell({ date, slot: slot.key })}
                className="hover:bg-muted/60 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors"
              >
                <span className="text-muted-foreground block text-xs font-medium leading-snug wrap-anywhere">{slot.label}</span>
                <span
                  className={cn(
                    // Clamped: one runaway cell must not push the rest of today
                    // off the screen. The whole text is one tap away.
                    "line-clamp-6 whitespace-pre-line leading-relaxed wrap-anywhere",
                    empty && "text-muted-foreground italic",
                    cell.done && "text-muted-foreground",
                  )}
                >
                  {empty ? "Chưa ghi gì — chạm để ghi" : cell.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <WeighIn book={book} today={today} actions={actions} />
    </Card>
  );
}

/** "Cân sáng nay": one number a day, typed the Vietnamese way ("60,4"). */
function WeighIn({ book, today, actions }: { book: NotebookView; today: string; actions: NotebookActions }) {
  const saved = book.metric.readings.find((r) => r.date === today)?.value ?? null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const value = parseReading(text);
  const unit = book.metric.unit;

  if (saved !== null && !editing) {
    return (
      <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="flex items-center gap-2 text-sm">
          <Scale className="text-muted-foreground h-4 w-4 shrink-0" />
          {book.metric.label} sáng nay
          <strong className="text-base">
            {formatReading(saved)} {unit}
          </strong>
        </span>
        <Button variant="ghost" className="h-9 px-3" onClick={() => { setText(formatReading(saved)); setEditing(true); }}>
          Sửa
        </Button>
      </div>
    );
  }

  return (
    <form
      className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value === null) return;
        actions.logReading.mutate({ id: book.id, date: today, value });
        setEditing(false);
      }}
    >
      <label htmlFor="weigh-in" className="flex items-center gap-2 text-sm">
        <Scale className="text-muted-foreground h-4 w-4 shrink-0" />
        {book.metric.label} sáng nay
      </label>
      <span className="flex items-center gap-1.5">
        <input
          id="weigh-in"
          aria-label={`${book.metric.label} sáng nay, đơn vị ${unit}`}
          inputMode="decimal"
          placeholder="60,4"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border-border bg-card focus:border-accent focus:ring-ring/30 h-10 w-20 rounded-lg border px-2 text-right tabular-nums outline-none focus:ring-2"
        />
        <span className="text-muted-foreground text-sm">{unit}</span>
      </span>
      <Button type="submit" className="ml-auto h-10 px-4" disabled={value === null}>
        Lưu
      </Button>
    </form>
  );
}
