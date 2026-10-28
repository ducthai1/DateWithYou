"use client";

import { useState } from "react";
import { Check, ChevronDown, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/date-keys";
import { dayMonth, dayProgress, formatReading, weekdayShort, type NotebookDay } from "@/lib/notebook";
import { weeksOf, type Week } from "@/lib/notebook-edit";
import type { NotebookView } from "./use-notebook-actions";

/** Weeks open at first: this one and the next — or, outside the plan, the end nearest to now. */
function initiallyOpen(weeks: Week[], today: string): Set<number> {
  const current = weeks.findIndex((w) => w.start <= today && today <= w.end);
  if (current >= 0) return new Set([current, current + 1]);
  return new Set(today < (weeks[0]?.start ?? "") ? [0, 1] : [weeks.length - 1]);
}

/**
 * The whole plan, a week at a time.
 *
 * It was one table of every day: on a phone that scrolled sideways inside its
 * frame showing the date and one column, each day half a screen tall, 45 days
 * about twenty screens, with the days already gone at the top. Now a week is a
 * heading that opens and closes; this week and the next are open; on a phone
 * each day is a card with every column stacked, on a wider screen a table.
 * Tapping a day opens the sheet that edits all of it.
 */
export function NotebookWeekPlan({ book, today, onEdit }: { book: NotebookView; today: string; onEdit: (date: string) => void }) {
  const weeks = weeksOf(book.days.map((d) => d.date));
  const [open, setOpen] = useState(() => initiallyOpen(weeks, today));
  const byDate = new Map(book.days.map((d) => [d.date, d]));
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <div className="space-y-2">
      {weeks.map((week, i) => {
        const days = week.dates.map((d) => byDate.get(d)!);
        const marks = book.metric.targets.filter((t) => t.date >= week.start && t.date <= week.end);
        const progress = days.reduce((acc, d) => { const p = dayProgress(d); return { done: acc.done + p.done, total: acc.total + p.total }; }, { done: 0, total: 0 });
        const isNow = week.start <= today && today <= week.end;
        const past = week.end < today;
        const expanded = open.has(i);
        return (
          <section key={week.start} className="border-border overflow-hidden rounded-xl border" data-week={week.index}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(i)}
              className={cn("hover:bg-muted/50 flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left", isNow && "bg-accent-soft/60")}
            >
              <span className="min-w-0 flex-1">
                <span className="font-semibold">Tuần {week.index}</span>
                <span className="text-muted-foreground"> · {dayMonth(week.dates[0])} – {dayMonth(week.dates.at(-1)!)}</span>
                {isNow && <span className="text-accent-ink ml-1.5 text-xs font-semibold">tuần này</span>}
                {past && <span className="text-muted-foreground ml-1.5 text-xs">đã qua</span>}
                {marks.length > 0 && (
                  <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                    <Flag className="h-3 w-3" aria-hidden />
                    {marks.map((m) => (
                      <span key={m.date}>
                        mốc {formatReading(m.value)} {book.metric.unit} ({weekdayShort(m.date)} {dayMonth(m.date)})
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {progress.total > 0 && (
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {progress.done}/{progress.total}
                </span>
              )}
              <ChevronDown className={cn("text-muted-foreground h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
            </button>
            {expanded && (
              <>
                <ul className="divide-border border-border divide-y border-t md:hidden">
                  {days.map((day) => (
                    <li key={day.date}>
                      <DayTile book={book} day={day} today={today} onEdit={onEdit} />
                    </li>
                  ))}
                </ul>
                <WeekTable book={book} days={days} today={today} onEdit={onEdit} />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

const dayName = (date: string, today: string) =>
  date === today ? "Hôm nay" : date === addDaysKey(today, 1) ? "Ngày mai" : null;

/** A day on a phone: every column stacked, so nothing scrolls sideways. */
function DayTile({ book, day, today, onEdit }: { book: NotebookView; day: NotebookDay; today: string; onEdit: (date: string) => void }) {
  const { done, total } = dayProgress(day);
  const rows = book.slots.filter((s) => day.cells[s.key].text.trim() !== "");
  const name = dayName(day.date, today);
  return (
    <button
      type="button"
      onClick={() => onEdit(day.date)}
      aria-label={`Sửa ngày ${weekdayShort(day.date)} ${dayMonth(day.date)}`}
      className={cn("hover:bg-muted/50 block w-full px-3 py-2.5 text-left", day.date === today && "bg-accent-soft/50", day.date < today && "text-muted-foreground")}
    >
      <span className="flex items-baseline gap-2">
        <span className="font-semibold tabular-nums">{weekdayShort(day.date)} {dayMonth(day.date)}</span>
        {name && <span className="text-accent-ink text-xs font-semibold">{name}</span>}
        {day.label && <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">{day.label}</span>}
        {total > 0 && <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">{done}/{total}</span>}
      </span>
      {rows.length === 0 ? (
        <span className="text-muted-foreground mt-1 block text-sm italic">Chưa ghi gì — chạm để ghi</span>
      ) : (
        <span className="mt-1 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {rows.map((s) => {
            const cell = day.cells[s.key];
            return (
              <span key={s.key} className="contents">
                <span className="text-muted-foreground max-w-[6.5rem] text-xs leading-5 wrap-anywhere">{s.label}</span>
                <span className={cn("line-clamp-2 leading-5 wrap-anywhere", cell.done && "text-muted-foreground")}>
                  {cell.done && <Check className="text-accent mr-1 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={3} aria-label="đã xong" />}
                  {cell.text}
                </span>
              </span>
            );
          })}
        </span>
      )}
    </button>
  );
}

/** A week on a wider screen: a row per day, a column per slot. A row opens its day. */
function WeekTable({ book, days, today, onEdit }: { book: NotebookView; days: NotebookDay[]; today: string; onEdit: (date: string) => void }) {
  return (
    <table className="border-border hidden w-full table-fixed border-t text-sm md:table">
      <colgroup>
        <col style={{ width: 120 }} />
        {book.slots.map((s) => <col key={s.key} />)}
      </colgroup>
      <thead>
        <tr className="border-border text-muted-foreground border-b text-left text-xs">
          <th scope="col" className="px-3 py-2 font-medium">Ngày</th>
          {book.slots.map((s) => <th key={s.key} scope="col" className="px-3 py-2 font-medium wrap-anywhere">{s.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr
            key={day.date}
            onClick={() => onEdit(day.date)}
            aria-current={day.date === today ? "date" : undefined}
            className={cn("border-border hover:bg-muted/50 cursor-pointer border-b align-top last:border-b-0", day.date === today && "bg-accent-soft/50", day.date < today && "text-muted-foreground")}
          >
            <th scope="row" className="px-3 py-2 text-left font-normal">
              <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); onEdit(day.date); }} aria-label={`Sửa ngày ${dayMonth(day.date)}`}>
                <span className="block font-semibold tabular-nums">{weekdayShort(day.date)} {dayMonth(day.date)}</span>
                {dayName(day.date, today) && <span className="text-accent-ink block text-xs font-medium">{dayName(day.date, today)}</span>}
                {day.label && <span className="text-muted-foreground block text-xs leading-snug wrap-anywhere">{day.label}</span>}
              </button>
            </th>
            {book.slots.map((s) => {
              const cell = day.cells[s.key];
              return (
                <td key={s.key} className={cn("px-3 py-2 leading-snug", (cell.done || !cell.text) && "text-muted-foreground")}>
                  <span className="line-clamp-4 whitespace-pre-line wrap-anywhere">
                    {cell.done && <Check className="text-accent mr-1 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={3} aria-label="đã xong" />}
                    {cell.text || "—"}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
