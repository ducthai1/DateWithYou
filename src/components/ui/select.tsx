"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { foldForSearch } from "@/lib/vietnamese-text";
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
  /**
   * Show a filter box inside the menu. Worth turning on past roughly a dozen
   * options; below that it is a box to skip past.
   */
  searchable?: boolean;
  /**
   * Called as the filter text changes, for lists too large to hold in the
   * client — the caller replaces `options` with the results. Without it the
   * filter runs over `options` locally.
   */
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  /** Shown when the filter matches nothing. */
  emptyLabel?: string;
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
  searchable,
  onSearch,
  searchPlaceholder = "Tìm…",
  emptyLabel = "Không tìm thấy",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /*
   * With onSearch the caller owns filtering (it is fetching), so `options` is
   * already the result set and filtering it again would hide rows the server
   * deliberately returned. Without it, filter here — accent-insensitively,
   * through the same folding the rest of the app searches with, so "sai gon"
   * finds "Sài Gòn".
   */
  const visible = !searchable || onSearch || !query
    ? options
    : options.filter((o) => foldForSearch(o.label).includes(foldForSearch(query)));

  // Reset between openings: a stale filter makes a reopened menu look empty.
  useEffect(() => {
    if (!open) {
      setQuery("");
      onSearch?.("");
      return;
    }
    /*
     * Only autofocus with a real keyboard. On a touch device this would throw
     * the on-screen keyboard over the options the person just opened the menu
     * to look at — they can tap the field when they want to type.
     */
    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;
    if (isTouch) return;
    // Focus after the menu has been positioned, or the page jumps.
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
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
    /*
     * The menu is position:fixed at coordinates captured on open, so a page or
     * column scroll would detach it from the trigger — hence closing on scroll.
     *
     * Resize is different on a phone, and closing on it made the searchable
     * menu unusable there: opening the on-screen keyboard resizes the visual
     * viewport, which fired resize, which shut the menu. Tap the field, the
     * keyboard rises, the menu vanishes. Every time.
     *
     * A keyboard changes the viewport height and leaves the width alone, while
     * the resizes this guard is actually for — rotation, a desktop window being
     * dragged — change the width. So only a width change closes it.
     */
    const widthAtOpen = window.innerWidth;
    const onScrollResize = (e: Event) => {
      // Ignore scroll events originating from inside the dropdown menu itself
      if (e.type === "scroll" && menuRef.current?.contains(e.target as Node)) {
        return;
      }
      if (e.type === "resize" && window.innerWidth === widthAtOpen) {
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
                className={cn(
                  "border-border bg-card fixed z-50 overflow-y-auto rounded-xl border shadow-xl origin-top",
                  /*
                   * No top padding when there is a search field. That field is
                   * sticky at top:0, which pins it to the padding box — 4px
                   * below the container's edge — so options scrolled past it
                   * showed through the strip above it. With pt-0 the field sits
                   * flush against the top and nothing can appear behind it.
                   */
                  searchable ? "pb-1" : "py-1",
                )}
                style={{ top: layout.top, left: layout.left, width: layout.width, maxHeight: layout.maxHeight }}
              >
            {searchable ? (
              <div className="border-border/70 sticky top-0 z-10 border-b bg-card px-2 pb-2 pt-1.5">
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      onSearch?.(e.target.value);
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="border-border/70 bg-background focus:border-accent focus:ring-ring/30 w-full rounded-lg border py-1.5 pl-8 pr-2 text-sm outline-none focus:ring-2"
                  />
                </div>
              </div>
            ) : null}
            {visible.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {emptyLabel}
              </p>
            ) : null}
            {visible.map((opt) => {
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
