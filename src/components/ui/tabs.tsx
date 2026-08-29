"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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

  /*
   * The moving pill is measured off the real button rather than computed as
   * `100 / tabs.length`.
   *
   * That formula only holds while every tab is exactly the same width, and
   * holding them equal is what broke the strip: the vault pinned itself to
   * min-w-[400px] so four tabs got 100px each, which is narrower than "Phiếu
   * bé ngoan" — so the labels wrapped onto two lines and the last tab was cut
   * off the screen. Measuring instead lets tabs take the width their words
   * need, and the indicator still lands on them.
   */
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
  useIsoLayout(() => {
    const measure = () => {
      const el = buttonRefs.current[activeIndex];
      if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    // Labels reflow when the strip resizes or a webfont finally lands.
    const ro = new ResizeObserver(measure);
    const strip = buttonRefs.current[activeIndex]?.parentElement;
    if (strip) ro.observe(strip);
    return () => ro.disconnect();
  }, [activeIndex, tabs.length]);

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
        "relative flex rounded-xl p-1 text-sm",
        "bg-card/85 border border-border shadow-sm backdrop-blur-xl",
        // A hairline of light along the top edge. It is what separates a
        // raised surface from a painted rectangle, and it is the difference
        // between the strip sitting ON the page and sitting IN it.
        "ring-1 ring-inset ring-white/50",
        className,
      )}
    >
      <div className="absolute inset-y-1 left-0 right-0 pointer-events-none" aria-hidden="true">
        <motion.div
          className="bg-accent h-full rounded-lg shadow-[0_2px_8px_var(--accent-soft),0_1px_3px_rgb(0_0_0/0.18)]"
          initial={false}
          animate={ind ? { width: ind.width, x: ind.left } : { width: 0, x: 0 }}
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
            // whitespace-nowrap: a tab label is a name, not a paragraph. Wrapping
            // one onto two lines makes the whole strip look broken.
            "relative flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 transition-colors z-10 font-medium",
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
