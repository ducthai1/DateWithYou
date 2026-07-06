"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Centered modal in a body portal. Solid card surface, dimmed backdrop, closes
 * on Escape, backdrop click, or the corner button. Body scroll is locked while
 * open so the page behind doesn't move.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "bg-card border-border relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl cursor-default",
              "max-h-[90dvh]",
              className,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ModalHeader({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted -mr-2 rounded-lg transition-colors touch-manipulation"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export function ModalContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto p-5", className)}>{children}</div>;
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // Mobile: stack full-width (flex-col → children stretch) so the primary
        // action sits last/lowest, thumb-reachable, and Cancel is never pushed
        // off-screen. Extra bottom pad clears the home indicator inside a sheet.
        // Desktop (sm+) restores the original right-aligned button row.
        "bg-card border-border flex shrink-0 flex-col-reverse gap-2 border-t px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
        "sm:flex-row sm:items-center sm:justify-end sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
