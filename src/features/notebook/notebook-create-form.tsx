"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { addDaysKey, todayKey } from "@/lib/date-keys";
import { NOTEBOOK_LIMITS, dayKeysBetween } from "@/lib/notebook";

/** A new notebook: a name, a date range, and the columns each day has. */
export function NotebookCreateForm({ onCreated, onClose }: { onCreated: (id: string) => void; onClose: () => void }) {
  const today = todayKey();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDaysKey(today, 13));
  const [columns, setColumns] = useState("Trưa, Tối");
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const create = trpc.notebook.create.useMutation({
    onSuccess: ({ id }) => {
      void utils.notebook.list.invalidate();
      onCreated(id);
    },
    onError: (e) => setError(readableFormError(e.message)),
  });

  const slots = columns
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dayCount = dayKeysBetween(start, end).length;
  const problem =
    title.trim() === ""
      ? "Đặt tên cho sổ"
      : dayCount === 0
        ? `Ngày kết thúc phải sau ngày bắt đầu, tối đa ${NOTEBOOK_LIMITS.days} ngày`
        : slots.length === 0
          ? "Cần ít nhất một cột"
          : slots.length > NOTEBOOK_LIMITS.slots
            ? `Tối đa ${NOTEBOOK_LIMITS.slots} cột`
            : slots.some((s) => s.length > NOTEBOOK_LIMITS.slotLabel)
              ? `Tên cột tối đa ${NOTEBOOK_LIMITS.slotLabel} ký tự`
              : null;

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <ModalHeader title="Sổ mới" onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (problem) return;
          setError(null);
          create.mutate({ title: title.trim(), start, end, slots });
        }}
      >
        <ModalContent className="space-y-3">
          <Input
            label="Tên sổ"
            value={title}
            maxLength={NOTEBOOK_LIMITS.title}
            placeholder="Vd: Siết cân, Lịch tập tháng 11"
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">Từ ngày</span>
              <DatePicker value={start} onChange={setStart} ariaLabel="Ngày bắt đầu" />
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Đến ngày</span>
              <DatePicker value={end} onChange={setEnd} min={start} ariaLabel="Ngày kết thúc" />
            </div>
          </div>
          <Input
            label="Các cột, cách nhau bởi dấu phẩy"
            hint="Vd: Trưa 12h, Bữa phụ 17h30, Tối 19h30, Tập"
            value={columns}
            onChange={(e) => setColumns(e.target.value)}
          />
          {dayCount > 0 && slots.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {dayCount} ngày × {slots.length} cột
            </p>
          )}
          {(error ?? (title ? problem : null)) && (
            <p role="alert" className="text-destructive text-sm">
              {error ?? problem}
            </p>
          )}
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Không
          </Button>
          <Button type="submit" disabled={!!problem || create.isPending}>
            {create.isPending ? "Đang tạo…" : "Tạo sổ"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
