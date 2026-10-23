"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NOTEBOOK_LIMITS, dayMonth, weekdayLong, type CellRef } from "@/lib/notebook";
import { NotebookCheck } from "./notebook-check";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

/** One cell opened: write what goes in it, tick it, or move it to another day. */
export function NotebookCellSheet({
  book,
  cellRef,
  actions,
  onStartSwap,
  onClose,
}: {
  book: NotebookView;
  cellRef: CellRef;
  actions: NotebookActions;
  onStartSwap: (ref: CellRef) => void;
  onClose: () => void;
}) {
  const slot = book.slots.find((s) => s.key === cellRef.slot);
  const cell = book.days.find((d) => d.date === cellRef.date)?.cells[cellRef.slot];
  const [text, setText] = useState(cell?.text ?? "");
  if (!slot || !cell) return null;

  const changed = text.trim() !== cell.text.trim();
  const save = () => {
    if (changed) actions.setCell.mutate({ id: book.id, ...cellRef, text });
  };

  return (
    <Modal open onClose={onClose} className="max-w-lg">
      <ModalHeader title={`${slot.label} · ${weekdayLong(cellRef.date)} ${dayMonth(cellRef.date)}`} onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
          onClose();
        }}
      >
        <ModalContent className="space-y-3">
          <Textarea
            aria-label={`Nội dung ${slot.label}`}
            value={text}
            maxLength={NOTEBOOK_LIMITS.cellText}
            rows={5}
            autoFocus
            placeholder="Vd: 220g ức gà + 6 lòng trắng + rau luộc"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1 text-sm">
              <NotebookCheck
                done={cell.done}
                disabled={cell.text.trim() === "" && text.trim() === ""}
                label={cell.done ? "Bỏ đánh dấu đã xong" : "Đánh dấu đã xong"}
                onToggle={() => actions.toggleCell.mutate({ id: book.id, ...cellRef, done: !cell.done })}
              />
              Đã xong
            </label>
            <span className="text-muted-foreground text-xs tabular-nums">
              {text.length}/{NOTEBOOK_LIMITS.cellText}
            </span>
          </div>
        </ModalContent>
        <ModalFooter className="flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={() => {
              save();
              onStartSwap(cellRef);
            }}
          >
            <ArrowLeftRight className="mr-1.5 h-4 w-4" />
            Đổi chỗ với ô khác
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" disabled={!changed}>
            Lưu
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
