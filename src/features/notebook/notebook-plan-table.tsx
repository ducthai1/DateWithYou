"use client";

import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayMonth, weekdayShort, type CellRef } from "@/lib/notebook";
import type { NotebookView } from "./use-notebook-actions";

/**
 * The whole plan at a glance: a row per day, a column per slot.
 *
 * On a phone the table is wider than the screen, so it scrolls sideways inside
 * its own frame with the date column pinned — the page itself must never
 * scroll sideways. Columns have a fixed width rather than `auto`: an auto
 * column cannot be narrower than its longest unbreakable word, and one pasted
 * link in a cell would push the whole table wide.
 */
export function NotebookPlanTable({
  book,
  today,
  swapFrom,
  onOpenCell,
  onPickSwap,
  onCancelSwap,
  onEditDay,
  onEditSlot,
}: {
  book: NotebookView;
  today: string;
  /** Set while the reader is choosing the second cell of a swap. */
  swapFrom: CellRef | null;
  onOpenCell: (ref: CellRef) => void;
  onPickSwap: (ref: CellRef) => void;
  onCancelSwap: () => void;
  onEditDay: (date: string) => void;
  onEditSlot: (slot: string) => void;
}) {
  const fromSlot = swapFrom ? book.slots.find((s) => s.key === swapFrom.slot) : null;

  return (
    <div className="space-y-2">
      {swapFrom && (
        <div role="status" className="bg-accent-soft text-accent-ink flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
          <span className="min-w-0 wrap-anywhere">
            Chạm vào ô muốn đổi chỗ với <strong>{fromSlot?.label}</strong> ngày {weekdayShort(swapFrom.date)}{" "}
            {dayMonth(swapFrom.date)}
          </span>
          <button
            type="button"
            onClick={onCancelSwap}
            className="hover:bg-card/60 inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 font-medium"
          >
            <X className="h-4 w-4" /> Huỷ
          </button>
        </div>
      )}

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 104 + book.slots.length * 168 }}>
          <colgroup>
            <col style={{ width: 104 }} />
            {book.slots.map((s) => (
              <col key={s.key} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="bg-card text-muted-foreground sticky left-0 z-10 px-3 py-2 text-left text-xs font-medium">
                Ngày
              </th>
              {book.slots.map((s) => (
                <th key={s.key} scope="col" className="p-0 text-left">
                  <button
                    type="button"
                    onClick={() => onEditSlot(s.key)}
                    aria-label={`Đổi tên cột ${s.label}`}
                    className="text-muted-foreground hover:text-foreground group flex min-h-10 w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium"
                  >
                    <span className="min-w-0 wrap-anywhere">{s.label}</span>
                    {/* Always faintly visible: a phone has no hover to reveal it. */}
                    <Pencil className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {book.days.map((day) => {
              const isToday = day.date === today;
              const past = day.date < today;
              return (
                <tr
                  key={day.date}
                  aria-current={isToday ? "date" : undefined}
                  className={cn("border-border border-b last:border-b-0", isToday && "bg-accent-soft/60")}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 p-0 text-left align-top font-normal",
                      isToday ? "bg-accent-soft" : "bg-card",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onEditDay(day.date)}
                      aria-label={`Ghi nhãn cho ngày ${dayMonth(day.date)}`}
                      className={cn(
                        "flex w-full flex-col px-3 py-2 text-left",
                        isToday && "border-accent border-l-4 pl-2",
                        past && !isToday && "text-muted-foreground",
                      )}
                    >
                      <span className="font-semibold tabular-nums">
                        {weekdayShort(day.date)} {dayMonth(day.date)}
                      </span>
                      {isToday && <span className="text-accent-ink text-xs font-medium">Hôm nay</span>}
                      {day.label && (
                        <span className="text-muted-foreground text-xs leading-snug wrap-anywhere">{day.label}</span>
                      )}
                    </button>
                  </th>
                  {book.slots.map((slot) => {
                    const cell = day.cells[slot.key];
                    const ref = { date: day.date, slot: slot.key };
                    const isSource = swapFrom?.date === day.date && swapFrom.slot === slot.key;
                    const empty = cell.text.trim() === "";
                    return (
                      <td key={slot.key} className="p-0 align-top">
                        <button
                          type="button"
                          onClick={() => (swapFrom ? onPickSwap(ref) : onOpenCell(ref))}
                          aria-label={`${slot.label} ngày ${dayMonth(day.date)}${cell.done ? ", đã xong" : ""}`}
                          className={cn(
                            "flex min-h-14 w-full items-start gap-1.5 px-3 py-2 text-left transition-colors",
                            swapFrom ? "hover:bg-accent-soft" : "hover:bg-muted/60",
                            isSource && "ring-accent ring-2 ring-inset",
                          )}
                        >
                          {cell.done && <Check className="text-accent mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />}
                          <span
                            className={cn(
                              "line-clamp-4 min-w-0 whitespace-pre-line leading-snug wrap-anywhere",
                              (empty || cell.done || past) && "text-muted-foreground",
                            )}
                          >
                            {empty ? "—" : cell.text}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
