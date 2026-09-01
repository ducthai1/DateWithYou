"use client";

import { Modal, ModalContent, ModalFooter } from "./modal";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";

type Tone = "danger" | "warning" | "question";

const TONES: Record<Tone, { Icon: typeof HelpCircle; wrap: string; confirm: string }> = {
  danger: {
    Icon: Trash2,
    wrap: "bg-destructive-soft text-destructive",
    confirm: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  warning: {
    Icon: AlertTriangle,
    wrap: "bg-amber-100 text-amber-700",
    confirm: "",
  },
  question: {
    Icon: HelpCircle,
    wrap: "bg-accent-soft text-accent",
    confirm: "",
  },
};

/**
 * The in-app answer to `window.confirm()`.
 *
 * A native confirm is a system chrome box: it ignores the app's typography and
 * colour entirely, cannot say which of the two answers is the destructive one,
 * and on iOS names the site above the question. Deleting a trip used one while
 * every other destructive action in the app asked in the app's own voice.
 *
 * Built on the shared <Modal>, and the sibling of <AlertModal>: same shell,
 * same tone circle, same proportions — one asks, the other tells. Which means
 * it stacks correctly over a dialog that is already open, which is the usual
 * case here (deleting is offered from inside the edit form).
 *
 * `pending` covers the gap between pressing and the row actually going: the
 * confirm button holds instead of the dialog vanishing while a request is still
 * in flight, so a second press cannot fire a second delete.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  tone = "danger",
  confirmLabel = "Xoá",
  cancelLabel = "Huỷ",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
}) {
  const { Icon, wrap, confirm } = TONES[tone];

  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} className="max-w-sm">
      <ModalContent className="flex flex-col items-center gap-3 pt-7 text-center">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", wrap)}>
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button className={cn("flex-1", confirm)} onClick={onConfirm} disabled={pending}>
          {pending ? "Đang xoá…" : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
