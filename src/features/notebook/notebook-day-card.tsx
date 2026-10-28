"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/date-keys";
import { dayMonth, dayProgress, formatReading, parseReading, weekdayLong } from "@/lib/notebook";
import { NotebookCheck } from "./notebook-check";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

/** "Hôm nay", "Hôm qua", "Ngày mai" — or nothing for a day further away. */
function relativeName(date: string, today: string): string | null {
  if (date === today) return "Hôm nay";
  if (date === addDaysKey(today, -1)) return "Hôm qua";
  if (date === addDaysKey(today, 1)) return "Ngày mai";
  return null;
}

/**
 * One day of the plan, as a checklist — today by default, any other with the
 * arrows. It used to show today and only today, so "what do I cook tomorrow"
 * meant hunting through a 45-row table; and a weigh-in forgotten yesterday had
 * nowhere to go.
 */
export function NotebookDayCard({
  book,
  date,
  today,
  actions,
  onGo,
  onEdit,
}: {
  book: NotebookView;
  date: string;
  today: string;
  actions: NotebookActions;
  /** Move the card to another day of the plan. */
  onGo: (date: string) => void;
  /** Open the day sheet for this day. */
  onEdit: (date: string) => void;
}) {
  const index = book.days.findIndex((d) => d.date === date);
  const day = book.days[index];
  if (!day) return null;
  const prev = book.days[index - 1]?.date;
  const next = book.days[index + 1]?.date;
  const name = relativeName(date, today);
  const { done, total } = dayProgress(day);
  const todayInPlan = book.days.some((d) => d.date === today);

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Ngày trước" disabled={!prev} onClick={() => prev && onGo(prev)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="min-w-0 flex-1 text-center text-lg font-semibold leading-snug">
          {name && <span className="text-accent-ink">{name} · </span>}
          {weekdayLong(date)} {dayMonth(date)}
        </h2>
        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Ngày sau" disabled={!next} onClick={() => next && onGo(next)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {/* Its own line, the card's full width: between the arrows a long label broke into scraps. */}
      <p className="text-muted-foreground -mt-2 text-center text-sm wrap-anywhere">
        {day.label && <span className="text-foreground">{day.label} · </span>}
        <span className="tabular-nums">{total > 0 ? `xong ${done}/${total}` : "chưa ghi gì"}</span>
      </p>

      <ul className="divide-border divide-y">
        {/* Only what the day asks for: an empty snack column was a "chưa ghi gì"
            row on every normal day. A day with nothing yet shows every column. */}
        {book.slots.filter((s) => total === 0 || day.cells[s.key].text.trim() !== "").map((slot) => {
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
                onClick={() => onEdit(date)}
                className="hover:bg-muted/60 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors"
              >
                <span className="text-muted-foreground block text-xs font-medium leading-snug wrap-anywhere">{slot.label}</span>
                <span
                  className={cn(
                    // Clamped: one runaway cell must not push the rest of the day off screen.
                    "line-clamp-6 whitespace-pre-line leading-relaxed wrap-anywhere",
                    empty && "text-muted-foreground italic",
                    cell.done && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {empty ? "Chưa ghi gì" : cell.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-10 px-3" onClick={() => onEdit(date)}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Sửa ngày này
        </Button>
        {date !== today && todayInPlan && (
          <Button variant="ghost" className="h-10 px-3" onClick={() => onGo(today)}>
            Về hôm nay
          </Button>
        )}
      </div>

      {/* A number can be written for today or any day gone by — not for a morning that has not come. */}
      {date <= today && <WeighIn key={date} book={book} date={date} today={today} actions={actions} />}
    </Card>
  );
}

/** The day's number, typed the Vietnamese way ("60,4"); saved, it can be changed or cleared. */
function WeighIn({ book, date, today, actions }: { book: NotebookView; date: string; today: string; actions: NotebookActions }) {
  const saved = book.metric.readings.find((r) => r.date === date)?.value ?? null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const value = parseReading(text);
  const { unit, label } = book.metric;
  const when = date === today ? "sáng nay" : `ngày ${dayMonth(date)}`;

  if (saved !== null && !editing) {
    return (
      <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="flex items-center gap-2 text-sm">
          <Scale className="text-muted-foreground h-4 w-4 shrink-0" />
          {label} {when}
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
        // Emptied while editing a saved number: that is "remove it".
        if (text.trim() === "" && saved !== null) actions.logReading.mutate({ id: book.id, date, value: null });
        else if (value !== null) actions.logReading.mutate({ id: book.id, date, value });
        else return;
        setEditing(false);
      }}
    >
      <label htmlFor={`weigh-${date}`} className="flex items-center gap-2 text-sm">
        <Scale className="text-muted-foreground h-4 w-4 shrink-0" />
        {label} {when}
      </label>
      <span className="flex items-center gap-1.5">
        <input
          id={`weigh-${date}`}
          aria-label={`${label} ${when}, đơn vị ${unit}`}
          inputMode="decimal"
          placeholder="60,4"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border-border bg-card focus:border-accent focus:ring-ring/30 h-10 w-20 rounded-lg border px-2 text-right tabular-nums outline-none focus:ring-2"
        />
        <span className="text-muted-foreground text-sm">{unit}</span>
      </span>
      <span className="ml-auto flex gap-1">
        {editing && (
          <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setEditing(false)}>
            Huỷ
          </Button>
        )}
        <Button type="submit" className="h-10 px-4" disabled={value === null && !(editing && text.trim() === "")}>
          {editing && text.trim() === "" ? "Xoá số" : "Lưu"}
        </Button>
      </span>
    </form>
  );
}
