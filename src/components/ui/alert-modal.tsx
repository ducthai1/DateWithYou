"use client";

import { Modal, ModalContent, ModalFooter } from "./modal";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, { Icon: typeof Info; wrap: string }> = {
  error: { Icon: AlertTriangle, wrap: "bg-destructive-soft text-destructive" },
  success: { Icon: CheckCircle2, wrap: "bg-emerald-100 text-emerald-700" },
  info: { Icon: Info, wrap: "bg-accent-soft text-accent" },
};

/**
 * In-app replacement for the native `alert()`. A small centered dialog with a
 * tone icon, title, message, and a single dismiss action. Reuses the shared
 * <Modal> shell so it inherits backdrop, Escape/backdrop close, and scroll
 * lock. Render conditionally on a message-bearing state, e.g.
 *   <AlertModal open={!!err} onClose={() => setErr(null)} tone="error" ... />
 */
export function AlertModal({
  open,
  onClose,
  title,
  message,
  tone = "info",
  actionLabel = "OK",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  tone?: Tone;
  actionLabel?: string;
}) {
  const { Icon, wrap } = TONES[tone];

  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <ModalContent className="flex flex-col items-center gap-3 pt-7 text-center">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", wrap)}>
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
      </ModalContent>
      <ModalFooter className="justify-center">
        <Button variant="primary" onClick={onClose} className="flex-1 min-w-28">
          {actionLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
