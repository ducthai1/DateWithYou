"use client";

import { useState } from "react";
import { ArrowLeftRight, Copy } from "lucide-react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NOTEBOOK_LIMITS, dayMonth, formatReading, parseReading, weekdayLong, weekdayShort } from "@/lib/notebook";
import { sameWeekdayAfter, weeksOf } from "@/lib/notebook-edit";
import { NotebookCheck } from "./notebook-check";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

type Mode = "edit" | "copy" | "swap";

/**
 * Everything about one day in one place: its label, every column, the ticks,
 * the day's number — and moving it: copy to other days, swap with another.
 * It replaces a sheet per cell, where filling in a day meant opening and
 * closing it once for every column.
 */
export function NotebookDaySheet({
  book, date, today, actions, onClose,
}: { book: NotebookView; date: string; today: string; actions: NotebookActions; onClose: () => void }) {
  const day = book.days.find((d) => d.date === date);
  const reading = book.metric.readings.find((r) => r.date === date)?.value;
  const [mode, setMode] = useState<Mode>("edit");
  const [label, setLabel] = useState(day?.label ?? "");
  const [texts, setTexts] = useState(() => Object.fromEntries(book.slots.map((s) => [s.key, day?.cells[s.key].text ?? ""])));
  const [weigh, setWeigh] = useState(reading !== undefined ? formatReading(reading) : "");
  const [copyTo, setCopyTo] = useState<Set<string>>(new Set());
  const [swapWith, setSwapWith] = useState("");
  if (!day) return null;

  const others = book.days.map((d) => d.date).filter((d) => d !== date);
  const changedCells = book.slots.filter((s) => texts[s.key].trim() !== day.cells[s.key].text.trim());
  const weighValue = parseReading(weigh);
  const weighChanged = date <= today && (weigh.trim() === "" ? reading !== undefined : weighValue !== null && weighValue !== reading);
  const weighBad = weigh.trim() !== "" && weighValue === null;
  const dirty = label.trim() !== day.label.trim() || changedCells.length > 0 || weighChanged;

  const save = async () => {
    if (label.trim() !== day.label.trim() || changedCells.length > 0)
      await actions.saveDay.mutateAsync({
        id: book.id, date,
        ...(label.trim() !== day.label.trim() && { label }),
        cells: changedCells.map((s) => ({ slot: s.key, text: texts[s.key] })),
      });
    if (weighChanged) await actions.logReading.mutateAsync({ id: book.id, date, value: weigh.trim() === "" ? null : weighValue });
  };
  const sameWeekday = sameWeekdayAfter(book.days.map((d) => d.date), date);

  return (
    <Modal open onClose={onClose} className="max-w-lg">
      <ModalHeader title={`${weekdayLong(date)} ${dayMonth(date)}`} onClose={onClose} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (weighBad) return;
          // Moving the day uses what is on the server, so unsaved edits go first.
          if (dirty) await save().catch(() => {});
          if (mode === "copy" && copyTo.size > 0) actions.copyDay.mutate({ id: book.id, from: date, to: [...copyTo] });
          if (mode === "swap" && swapWith) actions.swapDays.mutate({ id: book.id, a: date, b: swapWith });
          onClose();
        }}
      >
        <ModalContent className="space-y-3">
          {mode === "edit" && (
            <>
              <Input label="Nhãn ngày" value={label} maxLength={NOTEBOOK_LIMITS.dayLabel} placeholder="Vd: tập C, cầu lông, nghỉ" onChange={(e) => setLabel(e.target.value)} />
              {book.slots.map((s) => {
                const cell = day.cells[s.key];
                return (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere">{s.label}</span>
                      <label className="text-muted-foreground flex items-center text-xs">
                        <NotebookCheck
                          done={cell.done}
                          disabled={cell.text.trim() === "" && texts[s.key].trim() === ""}
                          label={`${s.label}: ${cell.done ? "bỏ đánh dấu đã xong" : "đánh dấu đã xong"}`}
                          onToggle={() => actions.toggleCell.mutate({ id: book.id, date, slot: s.key, done: !cell.done })}
                        />
                        Xong
                      </label>
                    </div>
                    <Textarea
                      aria-label={`${s.label} ngày ${dayMonth(date)}`}
                      value={texts[s.key]}
                      rows={2}
                      maxLength={NOTEBOOK_LIMITS.cellText}
                      placeholder="Chưa ghi gì"
                      onChange={(e) => setTexts((t) => ({ ...t, [s.key]: e.target.value }))}
                    />
                  </div>
                );
              })}
              {date <= today && (
                <div className="flex items-center gap-2">
                  <label htmlFor="sheet-weigh" className="text-sm font-medium">{book.metric.label} {date === today ? "sáng nay" : "ngày này"}</label>
                  <input
                    id="sheet-weigh"
                    aria-label={`${book.metric.label} ngày ${dayMonth(date)}, đơn vị ${book.metric.unit}`}
                    inputMode="decimal"
                    placeholder="—"
                    value={weigh}
                    onChange={(e) => setWeigh(e.target.value)}
                    aria-invalid={weighBad}
                    className={cn("border-border bg-card focus:border-accent h-10 w-24 rounded-lg border px-2 text-right tabular-nums outline-none", weighBad && "border-destructive")}
                  />
                  <span className="text-muted-foreground text-sm">{book.metric.unit}</span>
                </div>
              )}
            </>
          )}

          {mode === "copy" && (
            <div className="space-y-2">
              <p className="text-sm">Chép nhãn và nội dung ngày {dayMonth(date)} sang những ngày chọn dưới đây. Nội dung đang có ở đó sẽ bị thay.</p>
              {sameWeekday.length > 0 && (
                <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setCopyTo(new Set(sameWeekday))}>
                  Mọi {weekdayLong(date).toLowerCase()} sau ({sameWeekday.length} ngày)
                </Button>
              )}
              {/* By week: forty-odd dates in one heap were hard to find a day in. */}
              <div className="space-y-2" role="group" aria-label="Các ngày nhận bản chép">
                {weeksOf(book.days.map((d) => d.date)).map((w) => (
                  <div key={w.start}>
                    <p className="text-muted-foreground mb-1 text-xs">
                      Tuần {w.index} · {dayMonth(w.dates[0])} – {dayMonth(w.dates.at(-1)!)}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                      {w.dates.filter((d) => d !== date).map((d) => {
                        const on = copyTo.has(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setCopyTo((s) => { const n = new Set(s); if (on) n.delete(d); else n.add(d); return n; })}
                            className={cn("h-10 rounded-lg border px-1 text-xs tabular-nums", on ? "border-accent bg-accent-soft text-accent-ink font-semibold" : "border-border hover:bg-muted")}
                          >
                            {weekdayShort(d)} {dayMonth(d)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === "swap" && (
            <div className="space-y-2">
              <p className="text-sm">Đổi cả ngày {dayMonth(date)} (nhãn, nội dung, dấu xong) với ngày:</p>
              <Select
                aria-label="Ngày đổi với"
                value={swapWith}
                onChange={setSwapWith}
                placeholder="Chọn ngày"
                options={others.map((d) => ({ value: d, label: `${weekdayShort(d)} ${dayMonth(d)}${book.days.find((x) => x.date === d)?.label ? ` · ${book.days.find((x) => x.date === d)!.label}` : ""}` }))}
              />
            </div>
          )}
        </ModalContent>
        <ModalFooter className="flex-wrap">
          {mode === "edit" ? (
            <span className="mr-auto flex flex-wrap gap-1">
              <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setMode("copy")}>
                <Copy className="mr-1.5 h-4 w-4" />
                Chép sang ngày khác
              </Button>
              <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setMode("swap")}>
                <ArrowLeftRight className="mr-1.5 h-4 w-4" />
                Đổi với ngày khác
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" className="mr-auto" onClick={() => setMode("edit")}>
              Quay lại
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
          {mode === "edit" && <Button type="submit" disabled={!dirty || weighBad}>Lưu</Button>}
          {mode === "copy" && <Button type="submit" disabled={copyTo.size === 0}>Chép sang {copyTo.size} ngày</Button>}
          {mode === "swap" && <Button type="submit" disabled={!swapWith}>Đổi</Button>}
        </ModalFooter>
      </form>
    </Modal>
  );
}
