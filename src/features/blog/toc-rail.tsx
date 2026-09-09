"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocItem } from "./toc";

/**
 * The table of contents as a rail that tracks where the reader is.
 *
 * Same idea as the landing page's section rail — a quiet column of ticks, the
 * current one grown and in the accent — but it lives inside the article's own
 * side column rather than floating over the text, because that column already
 * exists here. A plain list told you what the article contains; this also tells
 * you where in it you are, which is the thing you want on a 1,500-word page.
 *
 * The links are real anchors rendered on the server, so the contents work
 * before hydration, without JavaScript, and for keyboard and screen-reader
 * users. The observer only decides which one is marked current.
 */
export function TocRail({
  items,
  className,
}: {
  items: TocItem[];
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const targets = items
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    /*
     * The observer is only a TRIGGER; the answer comes from measuring.
     *
     * Marking whichever heading the callback reported as intersecting a band
     * looked right while reading and was wrong after any fast scroll: a flick
     * or an anchor jump moves several headings through the band between two
     * frames, the browser reports only their end state, and the rail was left
     * pointing at a section the reader had passed. Measured on a 12-heading
     * article, four of eleven jumps landed on the wrong heading. Re-deriving
     * "the last heading whose top is above the reading line" on every callback
     * cannot be fooled that way, costs twelve rect reads, and needs no scroll
     * listener — the callback fires exactly when a heading crosses the line.
     */
    const LINE = 112; // the sticky header (64) plus a little reading room
    const pick = () => {
      let current = targets[0].id;
      for (const el of targets) {
        if (el.getBoundingClientRect().top - 8 <= LINE) current = el.id;
        else break;
      }
      setActive(current);
    };

    const io = new IntersectionObserver(pick, {
      rootMargin: `-${LINE}px 0px 0px 0px`,
      threshold: 0,
    });
    targets.forEach((el) => io.observe(el));
    pick();
    window.addEventListener("resize", pick);

    return () => {
      io.disconnect();
      window.removeEventListener("resize", pick);
    };
  }, [items]);

  if (items.length === 0) return null;
  const activeIndex = items.findIndex((h) => h.id === active);

  return (
    <nav
      aria-label="Mục lục"
      className={cn(
        "border-border bg-card rounded-2xl border p-4 shadow-sm",
        className,
      )}
    >
      <p className="text-muted-foreground mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
        Mục lục
      </p>
      {/*
       * The one place a scrollbar is allowed, and only when a very long
       * contents genuinely does not fit: capped so the card below it stays on
       * screen, with a hairline thumb instead of the platform scrollbar, which
       * looked like a mistake in a 21rem column.
       *
       * NO `overscroll-contain` here. `overflow-y-auto` makes this a scroll
       * container whether or not it has anything to scroll, and `contain` stops
       * a scroll container from chaining to the page — so pointing at the
       * contents and turning the wheel moved nothing at all. Measured: the page
       * advanced 300px then froze for five more wheel events, while the same
       * wheel over the article moved it 1500px. Without `contain` a full list
       * scrolls itself and then hands the rest to the page, which is what a
       * reader expects.
       */}
      <ol className="relative pr-1">
        {/* The spine, with the read part of it filled in. */}
        <span
          aria-hidden="true"
          className="bg-border absolute bottom-1.5 left-[3.5px] top-1.5 w-px"
        />
        <span
          aria-hidden="true"
          className="bg-accent/50 absolute left-[3.5px] top-1.5 w-px transition-[height] duration-300"
          style={{
            height:
              activeIndex < 0
                ? 0
                : `calc((100% - 0.75rem) * ${(activeIndex + 0.5) / items.length})`,
          }}
        />
        {items.map((h, i) => {
          const isActive = h.id === active;
          const isRead = activeIndex >= 0 && i < activeIndex;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group/toc relative flex items-start gap-2.5 py-1 text-sm outline-none",
                  h.level === 3 && "pl-3 text-[13px]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[6px] shrink-0 rounded-full transition-all duration-300",
                    isActive
                      ? "bg-accent h-2 w-2 ring-accent/25 -ml-[1px] ring-4"
                      : isRead
                        ? "bg-accent/50 h-1.5 w-1.5"
                        : "bg-border group-hover/toc:bg-accent/60 h-1.5 w-1.5",
                  )}
                />
                <span
                  className={cn(
                    "leading-snug transition-colors",
                    isActive
                      ? "text-accent font-semibold"
                      : "text-muted-foreground group-hover/toc:text-foreground",
                  )}
                >
                  {h.text}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
