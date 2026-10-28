"use client";

import { useState } from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { dayMonth, formatReading, parseReading } from "@/lib/notebook";
import { NotebookWeightChart } from "./notebook-weight-chart";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

/** The weigh-in line, the change so far, the numbers as a table, and the milestones to edit. */
export function NotebookWeightPanel({ book, actions }: { book: NotebookView; actions: NotebookActions }) {
  const { readings, targets, unit, label } = book.metric;
  const [editingTargets, setEditingTargets] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const firstReading = readings[0];
  const lastReading = readings.at(-1);
  const delta = firstReading && lastReading && readings.length > 1 ? lastReading.value - firstReading.value : null;
  const start = book.days[0]?.date;
  const end = book.days.at(-1)?.date;
  const dates = [...new Set([...readings, ...targets].map((p) => p.date))].sort();

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{label} mỗi sáng</h2>
          {lastReading ? (
            <p className="text-sm">
              <strong className="text-2xl font-semibold">{formatReading(lastReading.value)}</strong> {unit}
              {delta !== null && (
                <span className="text-muted-foreground ml-2">
                  {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
                  {formatReading(Math.abs(delta))} {unit} từ {dayMonth(firstReading.date)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Chưa có lần cân nào — nhập ở thẻ Hôm nay.</p>
          )}
        </div>
        <Button variant="outline" className="h-10 px-3" onClick={() => setEditingTargets(true)}>
          <Flag className="mr-1.5 h-4 w-4" />
          Sửa mốc
        </Button>
      </div>

      {(readings.length > 0 || targets.length > 0) && start && end && (
        <>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="bg-accent h-0.5 w-4 rounded" /> Đã cân
            </span>
            <span className="flex items-center gap-1.5">
              <span className="border-foreground h-2.5 w-2.5 rounded-full border-2" /> Mốc
            </span>
          </div>
          <NotebookWeightChart readings={readings} targets={targets} start={start} end={end} unit={unit} />
          <details className="text-sm">
            <summary className="text-muted-foreground hover:text-foreground flex min-h-10 cursor-pointer items-center">
              Xem từng ngày
            </summary>
            <p className="text-muted-foreground mt-1 text-xs">Quên cân hôm nào: lật thẻ ngày về hôm đó để ghi bù.</p>
            <table className="mt-1 w-full max-w-sm text-left tabular-nums">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="py-1 font-medium">Ngày</th>
                  <th className="py-1 font-medium">Đã cân</th>
                  <th className="py-1 font-medium">Mốc</th>
                  <th className="py-1"><span className="sr-only">Sửa</span></th>
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => {
                  const value = readings.find((p) => p.date === d)?.value;
                  return editing === d ? (
                    <ReadingEdit key={d} book={book} date={d} value={value} actions={actions} onDone={() => setEditing(null)} />
                  ) : (
                    <tr key={d} className="border-border border-t">
                      <td className="py-1">{dayMonth(d)}</td>
                      <td className="py-1">{fmt(value)}</td>
                      <td className="py-1">{fmt(targets.find((p) => p.date === d)?.value)}</td>
                      <td className="py-0.5 text-right">
                        {value !== undefined && (
                          <Button variant="ghost" className="h-9 px-2 text-xs" aria-label={`Sửa số ngày ${dayMonth(d)}`} onClick={() => setEditing(d)}>
                            Sửa
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </>
      )}

      {editingTargets && (
        <TargetsForm
          initial={targets}
          unit={unit}
          defaultDate={end ?? ""}
          onClose={() => setEditingTargets(false)}
          onSave={(next) => actions.setTargets.mutate({ id: book.id, targets: next })}
        />
      )}
    </Card>
  );
}

const fmt = (v: number | undefined) => (v === undefined ? "—" : formatReading(v));

/** One weigh-in, corrected or removed in place — a typo on a past morning used to be there for good. */
function ReadingEdit({
  book, date, value, actions, onDone,
}: { book: NotebookView; date: string; value: number | undefined; actions: NotebookActions; onDone: () => void }) {
  const [text, setText] = useState(value === undefined ? "" : formatReading(value));
  const parsed = parseReading(text);
  return (
    <tr className="border-border border-t">
      <td className="py-1">{dayMonth(date)}</td>
      <td className="py-1" colSpan={2}>
        <input
          autoFocus
          inputMode="decimal"
          aria-label={`${book.metric.label} ngày ${dayMonth(date)}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border-border bg-card focus:border-accent h-9 w-20 rounded-lg border px-2 text-right outline-none"
        />
      </td>
      <td className="py-1 text-right whitespace-nowrap">
        <Button variant="ghost" className="h-9 px-2 text-xs" disabled={parsed === null} onClick={() => { actions.logReading.mutate({ id: book.id, date, value: parsed! }); onDone(); }}>
          Lưu
        </Button>
        <Button variant="ghost" className="text-destructive h-9 px-2 text-xs" onClick={() => { actions.logReading.mutate({ id: book.id, date, value: null }); onDone(); }}>
          Xoá
        </Button>
        <Button variant="ghost" className="h-9 px-2 text-xs" onClick={onDone}>
          Huỷ
        </Button>
      </td>
    </tr>
  );
}

type Row = { date: string; text: string };

function TargetsForm({
  initial,
  unit,
  defaultDate,
  onSave,
  onClose,
}: {
  initial: { date: string; value: number }[];
  unit: string;
  defaultDate: string;
  onSave: (targets: { date: string; value: number }[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(initial.map((t) => ({ date: t.date, text: formatReading(t.value) })));
  const parsed = rows.map((r) => ({ date: r.date, value: parseReading(r.text) }));
  const valid = parsed.every((r) => r.date !== "" && r.value !== null);
  const set = (i: number, change: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <ModalHeader title="Mốc cân" onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave(parsed.map((r) => ({ date: r.date, value: r.value! })));
          onClose();
        }}
      >
        <ModalContent className="space-y-2">
          {rows.length === 0 && <p className="text-muted-foreground text-sm">Chưa có mốc nào.</p>}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-2">
              <DatePicker value={r.date} onChange={(date) => set(i, { date })} ariaLabel={`Ngày của mốc ${i + 1}`} />
              <span className="flex items-center gap-1">
                <input
                  inputMode="decimal"
                  aria-label={`Số ${unit} của mốc ${i + 1}`}
                  value={r.text}
                  onChange={(e) => set(i, { text: e.target.value })}
                  className="border-border bg-card focus:border-accent h-10 w-full min-w-0 rounded-lg border px-2 text-right tabular-nums outline-none"
                />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                aria-label={`Xoá mốc ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setRows((rs) => [...rs, { date: defaultDate, text: "" }])}>
            <Plus className="mr-1.5 h-4 w-4" />
            Thêm mốc
          </Button>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Không
          </Button>
          <Button type="submit" disabled={!valid}>
            Lưu
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
