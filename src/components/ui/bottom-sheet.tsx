"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { DialogTitleContext, dialogAttrs, useDialogA11y } from "./modal";

/**
 * Mobile bottom sheet in a body portal. Slides up from the bottom, dims and
 * blurs the page, locks body scroll, and dismisses on Escape, backdrop tap, or
 * a downward drag started from the grab handle. Drag is bound to the handle
 * only (via drag controls) so scrolling the sheet content never triggers a
 * dismiss. Desktop uses <Modal> instead; this shell targets small viewports.
 *
 * Prop signature mirrors <Modal> so callers can swap shells by viewport, and
 * it shares <Modal>'s dialog semantics: announced as a modal dialog, focus
 * moved in on open, Tab trapped inside, focus returned to the trigger on close.
 */
export function BottomSheet({
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
  const dragControls = useDragControls();
  const { containerRef, titleId, hasTitle, titleCtx } = useDialogA11y(open);

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
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm"
        >
          <motion.div
            ref={containerRef}
            {...dialogAttrs(titleId, hasTitle)}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
            className={cn(
              "bg-card border-border relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl",
              "outline-none",
              className,
            )}
          >
            {/* Grab handle — the only drag origin, so content scroll stays free */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1 active:cursor-grabbing"
              aria-hidden
            >
              <span className="bg-border h-1.5 w-10 rounded-full" />
            </div>
            <DialogTitleContext.Provider value={titleCtx}>
              {children}
            </DialogTitleContext.Provider>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
