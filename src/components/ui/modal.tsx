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
import { lockBodyScroll, releaseBodyScroll } from "@/lib/body-scroll-lock";
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
/** Width steps, so a confirm and a long form stop sharing one size. */
const MODAL_SIZE = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;

export function Modal({
  open,
  onClose,
  children,
  className,
  size = "lg",
  hidden = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /**
   * Defaults to `lg` (512px). Most dialogs here are three or four short
   * fields, and every one of them was 672px wide because that was the only
   * width available — wide enough to look like the layout had given up.
   * Content-heavy dialogs ask for `xl` explicitly.
   */
  size?: keyof typeof MODAL_SIZE;
  /**
   * Step out of the way without closing.
   *
   * For a dialog whose next step is on the page behind it — picking a point on
   * the map — closing would throw away everything typed so far, because the
   * fields live in the dialog's own children. This keeps them mounted and only
   * stops the dialog being seen or clicked.
   */
  hidden?: boolean;
}) {
  const { containerRef, titleId, hasTitle, titleCtx } = useDialogA11y(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // The lock is counted and shared — see body-scroll-lock. Owning it here
    // per-dialog is what left the page unscrollable after two overlapped.
    lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseBodyScroll();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          // Through `animate`, not a class: framer-motion writes opacity as an
          // inline style, which outranks any utility — the dialog went
          // click-through while staying fully visible over the map.
          animate={{ opacity: hidden ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm cursor-pointer",
            hidden && "pointer-events-none",
          )}
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
              "bg-card border-border relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl cursor-default",
              MODAL_SIZE[size],
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

export function ModalHeader({
  title,
  onClose,
  description,
  icon,
}: {
  title: React.ReactNode;
  onClose: () => void;
  /**
   * One line under the title, for what this dialog is for or what happens
   * next. Dialogs that need it were putting it as the first paragraph of the
   * body, where it read as content rather than as a subtitle.
   */
  description?: React.ReactNode;
  /** Small mark to the left of the title, so a dialog has an identity. */
  icon?: React.ReactNode;
}) {
  // Registering tells the surrounding shell it has a real heading to point
  // aria-labelledby at; without it the shell keeps its generic aria-label.
  const dialogTitle = useContext(DialogTitleContext);
  const registerTitle = dialogTitle?.registerTitle;
  useEffect(() => {
    registerTitle?.();
  }, [registerTitle]);

  return (
    <div className="border-border from-muted/40 flex shrink-0 items-start justify-between gap-3 border-b bg-gradient-to-b to-transparent px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className="bg-accent-soft text-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 id={dialogTitle?.titleId} className="text-lg font-semibold leading-tight">
            {title}
          </h2>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm leading-snug">{description}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted -mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors touch-manipulation"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * The dialog body, with a fade at whichever edge still has content behind it.
 *
 * A dialog capped at 90dvh silently cuts its body off: the last field of a long
 * form sat below the fold with a flat border under it, which reads as the end
 * of the form rather than as more to come. The fades only appear when there is
 * actually something past the edge.
 */
export function ModalContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const more = el.scrollHeight - el.clientHeight;
      setEdges({
        top: el.scrollTop > 4,
        bottom: more > 4 && el.scrollTop < more - 4,
      });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => { el.removeEventListener("scroll", measure); ro.disconnect(); };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden="true"
        className={cn(
          "from-card pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b to-transparent transition-opacity duration-200",
          edges.top ? "opacity-100" : "opacity-0",
        )}
      />
      <div ref={ref} className={cn("min-h-0 flex-1 overflow-y-auto p-5", className)}>
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "from-card pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t to-transparent transition-opacity duration-200",
          edges.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "border-border bg-muted/30 flex w-full shrink-0 flex-row items-center gap-2.5 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
