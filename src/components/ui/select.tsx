"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

const MENU_GAP = 4;
const MAX_MENU_HEIGHT = 256;

/**
 * Custom dropdown (not a native <select>): solid-white menu rendered in a body
 * portal so it never clips inside cards/overflow, with a rotating chevron, a
 * check on the active option, click-outside + Escape to close. Modelled on the
 * shared fe-crmv2 atom.
 */
export function Select({
  options,
  value,
  onChange,
  placeholder = "Chọn…",
  className,
  disabled,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - MENU_GAP - 8;
    const above = rect.top - MENU_GAP - 8;
    const openBelow = below >= Math.min(MAX_MENU_HEIGHT, 160) || below >= above;
    setLayout({
      top: openBelow ? rect.bottom + MENU_GAP : rect.top - MENU_GAP,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MAX_MENU_HEIGHT, Math.max(120, openBelow ? below : above)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // The menu is position:fixed at coordinates captured on open; if the page
    // or an inner column scrolls it would detach from the trigger, so close.
    const onScrollResize = (e: Event) => {
      // Ignore scroll events originating from inside the dropdown menu itself
      if (e.type === "scroll" && menuRef.current?.contains(e.target as Node)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "bg-card border-border flex h-11 w-full items-center justify-between gap-2 rounded-xl border pr-3 pl-3 text-sm transition-colors",
          open
            ? "border-accent ring-ring/40 ring-2"
            : "hover:border-muted-foreground/40",
          disabled && "bg-muted cursor-not-allowed opacity-60",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
            open && "text-accent rotate-180",
          )}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && layout && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                ref={menuRef}
                className="border-border bg-card fixed z-50 overflow-y-auto rounded-xl border py-1 shadow-xl origin-top"
                style={{ top: layout.top, left: layout.left, width: layout.width, maxHeight: layout.maxHeight }}
              >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-accent-soft text-accent font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="text-accent h-4 w-4 shrink-0" />}
                </button>
              );
            })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
