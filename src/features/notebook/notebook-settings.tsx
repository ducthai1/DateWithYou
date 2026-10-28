"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NOTEBOOK_LIMITS as L, dayMonth } from "@/lib/notebook";
import { applyRange, filledSlots, type SlotDraft, type StoredDay } from "@/lib/notebook-edit";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

const stored = (book: NotebookView): StoredDay[] =>
  book.days.map((d) => ({ date: d.date, label: d.label, cells: Object.entries(d.cells).map(([slot, c]) => ({ slot, ...c })) }));

const list = (dates: string[]) => (dates.length > 4 ? `${dates.slice(0, 4).map(dayMonth).join(", ")}…` : dates.map(dayMonth).join(", "));

/**
 * Everything about the notebook that used to be fixed once it was made: its
 * name, its dates, its columns, what the daily number is. Nothing is written
 * until "Lưu", and before that the form says what would be lost — days with
 * something written on them outside the new range, a column with text in it.
 */
export function NotebookSettings({
  book, actions, onRemove, onClose,
}: { book: NotebookView; actions: NotebookActions; onRemove: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(book.title);
  const [start, setStart] = useState(book.days[0]?.date ?? "");
  const [end, setEnd] = useState(book.days.at(-1)?.date ?? "");
  // `tmp` keeps a new column's row steady while it moves up and down; it never leaves the form.
  const [cols, setCols] = useState<(SlotDraft & { tmp?: number })[]>(book.slots.map((s) => ({ key: s.key, label: s.label })));
  const drafts = cols.map((c) => ({ ...(c.key && { key: c.key }), label: c.label }));
  const [metricLabel, setMetricLabel] = useState(book.metric.label);
  const [unit, setUnit] = useState(book.metric.unit);
  const [saving, setSaving] = useState(false);

  const days = stored(book);
  const range = applyRange(days, book.slots.map((s) => s.key), start, end);
  const used = filledSlots(days);
  const removedFilled = book.slots.filter((s) => used.has(s.key) && !cols.some((c) => c.key === s.key));
  const colsChanged = JSON.stringify(drafts) !== JSON.stringify(book.slots.map((s) => ({ key: s.key, label: s.label })));
  const rangeChanged = start !== book.days[0]?.date || end !== book.days.at(-1)?.date;
  const problem =
    title.trim() === "" ? "Đặt tên cho sổ"
      : !range ? `Ngày kết thúc phải sau ngày bắt đầu, tối đa ${L.days} ngày`
        : cols.length === 0 ? "Cần ít nhất một cột"
          : cols.some((c) => c.label.trim() === "") ? "Cột nào cũng cần tên"
            : metricLabel.trim() === "" ? "Đặt tên cho chỉ số" : null;
  const move = (i: number, by: number) =>
    setCols((cs) => { const n = [...cs]; const [c] = n.splice(i, 1); n.splice(i + by, 0, c); return n; });

  const save = async () => {
    setSaving(true);
    try {
      if (title.trim() !== book.title) await actions.rename.mutateAsync({ id: book.id, title: title.trim() });
      if (colsChanged) await actions.setSlots.mutateAsync({ id: book.id, slots: drafts.map((c) => ({ ...c, label: c.label.trim() })) });
      if (rangeChanged) await actions.setRange.mutateAsync({ id: book.id, start, end });
      if (metricLabel.trim() !== book.metric.label || unit.trim() !== book.metric.unit)
        await actions.setMetric.mutateAsync({ id: book.id, label: metricLabel.trim(), unit: unit.trim() });
      onClose();
    } catch {
      // The failing step already said why (toast); what saved before it stays saved.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-lg">
      <ModalHeader title="Tuỳ chỉnh sổ" onClose={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); if (!problem) void save(); }}>
        <ModalContent className="space-y-5">
          <Input label="Tên sổ" value={title} maxLength={L.title} onChange={(e) => setTitle(e.target.value)} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Khoảng ngày</legend>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={start} onChange={setStart} ariaLabel="Từ ngày" />
              <DatePicker value={end} onChange={setEnd} min={start} ariaLabel="Đến ngày" />
            </div>
            {range && rangeChanged && (
              <p className={range.lost.length ? "text-destructive text-sm" : "text-muted-foreground text-sm"} role={range.lost.length ? "alert" : undefined}>
                {range.days.length} ngày{range.added > 0 && ` · thêm ${range.added} ngày trống`}
                {range.lost.length > 0 && ` · bỏ ${range.lost.length} ngày đã có nội dung (${list(range.lost)}) — nội dung đó sẽ mất`}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Cột mỗi ngày</legend>
            {cols.map((c, i) => (
              <div key={c.key ?? `new-${c.tmp}`} className="grid grid-cols-[minmax(0,1fr)_repeat(3,2.25rem)] items-center gap-1">
                <input
                  aria-label={`Tên cột ${i + 1}`}
                  value={c.label}
                  maxLength={L.slotLabel}
                  onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className="border-border bg-card focus:border-accent h-10 w-full min-w-0 rounded-lg border px-3 outline-none"
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Đưa cột ${c.label} lên`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Đưa cột ${c.label} xuống`} disabled={i === cols.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Xoá cột ${c.label}`} disabled={cols.length === 1} onClick={() => setCols((cs) => cs.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {cols.length < L.slots && (
              <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setCols((cs) => [...cs, { label: "", tmp: Date.now() }])}>
                <Plus className="mr-1.5 h-4 w-4" />
                Thêm cột
              </Button>
            )}
            {removedFilled.length > 0 && (
              <p className="text-destructive text-sm" role="alert">
                Cột {removedFilled.map((s) => `“${s.label}”`).join(", ")} đang có nội dung — xoá là mất.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Chỉ số theo dõi mỗi ngày</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
              <input aria-label="Tên chỉ số" value={metricLabel} maxLength={L.metricLabel} placeholder="Cân" onChange={(e) => setMetricLabel(e.target.value)} className="border-border bg-card focus:border-accent h-10 min-w-0 rounded-lg border px-3 outline-none" />
              <input aria-label="Đơn vị" value={unit} maxLength={L.metricUnit} placeholder="kg" onChange={(e) => setUnit(e.target.value)} className="border-border bg-card focus:border-accent h-10 min-w-0 rounded-lg border px-3 outline-none" />
            </div>
          </fieldset>

          {problem && <p role="alert" className="text-destructive text-sm">{problem}</p>}
        </ModalContent>
        <ModalFooter className="flex-wrap">
          <ConfirmButton
            idle="Xoá sổ"
            icon={<Trash2 className="h-4 w-4" />}
            title="Xoá sổ này?"
            description="Cả lịch, các mục ghi chú và số cân trong sổ sẽ mất, không lấy lại được."
            confirmText="Xoá sổ"
            className="mr-auto"
            onConfirm={() => { onRemove(); onClose(); }}
          />
          <Button type="button" variant="ghost" onClick={onClose}>Không</Button>
          <Button type="submit" disabled={!!problem || saving}>{saving ? "Đang lưu…" : "Lưu"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
