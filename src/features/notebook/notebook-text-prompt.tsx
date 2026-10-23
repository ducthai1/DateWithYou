"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * One line of text to change: a notebook's name, a column's name, a day's
 * label. Three places, one dialog — each used to want its own copy.
 */
export function NotebookTextPrompt({
  title,
  label,
  initial,
  maxLength,
  allowEmpty = false,
  placeholder,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  initial: string;
  maxLength: number;
  /** A day label may be cleared; a name may not. */
  allowEmpty?: boolean;
  placeholder?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  const canSave = (allowEmpty || trimmed !== "") && trimmed !== initial.trim();

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <ModalHeader title={title} onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onSave(trimmed);
          onClose();
        }}
      >
        <ModalContent>
          <Input
            label={label}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Không
          </Button>
          <Button type="submit" disabled={!canSave}>
            Lưu
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
