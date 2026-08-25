"use client";

import { useId, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Controlled pill tabs — shared by the vault, library, calendar, wheel and
 * trip-detail screens.
 *
 * Implements the ARIA tabs pattern: the strip is a `tablist`, each pill a
 * `tab` carrying `aria-selected`, and ←/→/Home/End move between them. Each
 * pill also has a stable `id`, so a panel can point `aria-labelledby` back at
 * the tab that controls it.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  panelIdFor,
  label,
}: {
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
  /**
   * Optional: return the DOM id of the panel a tab controls, and each pill
   * gets `aria-controls`. Left out by default — pointing `aria-controls` at an
   * id that does not exist is worse for a screen reader than omitting it.
   */
  panelIdFor?: (key: T) => string;
  /** Accessible name for the strip itself, e.g. "Mục trong Góc bí mật". */
  label?: string;
}) {
  const baseId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = tabs.findIndex((t) => t.key === value);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;

    const target = tabs[next];
    if (!target) return;
    e.preventDefault();
    onChange(target.key);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        "bg-muted/60 flex rounded-xl p-1 text-sm relative border border-border/40",
        className,
      )}
    >
      <div className="absolute inset-y-1 left-1 right-1 pointer-events-none" aria-hidden="true">
        <motion.div
          className="h-full rounded-lg bg-accent shadow-md"
          initial={false}
          animate={{
            width: `${100 / tabs.length}%`,
            x: `${activeIndex * 100}%`,
          }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      </div>
      {tabs.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            buttonRefs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${baseId}-tab-${t.key}`}
          aria-selected={value === t.key}
          aria-controls={panelIdFor?.(t.key)}
          onClick={() => onChange(t.key)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={cn(
            "relative flex-1 cursor-pointer rounded-lg py-2 transition-colors z-10 font-medium",
            // outline-none alone left keyboard users with no focus indicator on
            // the vault, library, trip-detail and wheel screens — the ring is
            // the replacement, drawn with theme tokens so it follows the accent.
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            value === t.key
              ? "text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
