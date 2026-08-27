"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

/* ── Shared dialog accessibility ───────────────────────────────────────────
 * Used by <Modal> and by <BottomSheet>, which imports from here so the two
 * shells behave identically for a keyboard or screen-reader user. */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el.getAttribute("aria-hidden") !== "true" &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0),
  );
}

type DialogTitleValue = { titleId: string; registerTitle: () => void };

/** Lets <ModalHeader> hand its heading's id up to whichever shell wraps it. */
const DialogTitleContext = createContext<DialogTitleValue | null>(null);

/** Marks every open dialog shell so the trap can tell which one is on top. */
const DIALOG_SHELL_ATTR = "data-dialog-shell";

/**
 * Dialog focus + labelling for a portalled shell.
 *
 * - moves focus into the dialog on open (unless a child already claimed it via
 *   autoFocus, which React applies during the same commit),
 * - keeps Tab / Shift+Tab cycling inside it,
 * - hands focus back to whatever opened it on close,
 * - resolves `aria-labelledby` once a <ModalHeader> registers its heading.
 *
 * Escape-to-close stays with each shell — it is the only piece that differs.
 */
function useDialogA11y(open: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [hasTitle, setHasTitle] = useState(false);
  const registerTitle = useCallback(() => setHasTitle(true), []);
  const titleCtx = useMemo<DialogTitleValue>(
    () => ({ titleId, registerTitle }),
    [titleId, registerTitle],
  );

  // Who should get focus back on close. Seeded during this component's own
  // render — that happens before the dialog's children mount, so it still
  // points at the trigger even when a child grabs focus with autoFocus.
  const [openerAtMount] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  const openerRef = useRef<HTMLElement | null>(openerAtMount);

  // A long-lived `<Modal open={flag}/>` mounts closed, so keep the pointer
  // fresh while it is closed rather than freezing the mount-time value.
  useEffect(() => {
    if (open) return;
    const track = () => {
      openerRef.current = document.activeElement as HTMLElement | null;
    };
    track();
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (el && !el.contains(document.activeElement)) el.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const node = containerRef.current;
      if (!node) return;

      // Dialogs can stack (a confirm on top of a form). Portals append in open
      // order, so only the last shell in document order owns the trap.
      const stack = Array.from(
        document.querySelectorAll<HTMLElement>(`[${DIALOG_SHELL_ATTR}="true"]`),
      );
      if (stack.length > 0 && stack[stack.length - 1] !== node) return;

      const items = focusableIn(node);
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = node.contains(current);

      if (e.shiftKey) {
        // From the container itself, Shift+Tab would escape backwards.
        if (!inside || current === first || current === node) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  return { containerRef, titleId, hasTitle, titleCtx };
}

/** Everything a shell's inner element needs to be announced as a dialog. */
export function dialogAttrs(titleId: string, hasTitle: boolean) {
  return {
    role: "dialog" as const,
    "aria-modal": true,
    // Falls back to a generic name so a shell rendered without <ModalHeader>
    // is never announced as an unnamed dialog.
    "aria-labelledby": hasTitle ? titleId : undefined,
    "aria-label": hasTitle ? undefined : "Hộp thoại",
    tabIndex: -1,
    [DIALOG_SHELL_ATTR]: "true",
  };
}

export { DialogTitleContext, useDialogA11y };

/**
 * Centered modal in a body portal. Solid card surface, dimmed backdrop, closes
 * on Escape, backdrop click, or the corner button. Body scroll is locked while
 * open so the page behind doesn't move. Focus moves in on open, is trapped
 * while open, and returns to the trigger on close.
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm cursor-pointer"
        >
          <motion.div
            ref={containerRef}
            {...dialogAttrs(titleId, hasTitle)}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
            className={cn(
              "bg-card border-border relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl cursor-default",
              "max-h-[90dvh]",
              "outline-none",
              className,
            )}
          >
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

export function ModalHeader({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  // Registering tells the surrounding shell it has a real heading to point
  // aria-labelledby at; without it the shell keeps its generic aria-label.
  const dialogTitle = useContext(DialogTitleContext);
  const registerTitle = dialogTitle?.registerTitle;
  useEffect(() => {
    registerTitle?.();
  }, [registerTitle]);

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-5">
      <h2 id={dialogTitle?.titleId} className="text-lg font-semibold">
        {title}
      </h2>
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
        "bg-card border-border flex shrink-0 flex-row items-center w-full gap-2.5 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
