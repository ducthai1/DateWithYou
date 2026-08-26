"use client";

import { useEffect, useRef } from "react";

/**
 * Reveals its children as they scroll into view.
 *
 * An IntersectionObserver rather than a motion library: the landing page had
 * framer-motion removed on purpose (it was ~45kB in front of the largest
 * paint), and this is about a kilobyte. Children are passed through untouched,
 * so everything inside still renders on the server.
 *
 * The element is hidden by CSS, not by state, and the observer only ever flips
 * one attribute — so React never re-renders the subtree and the animation stays
 * on the compositor. A <noscript> rule in the layout un-hides everything for
 * browsers with JavaScript off.
 */
export function Reveal({
  children,
  /** Stagger within a group, in ms. */
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: "div" | "li" | "section";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Anything already on screen at first paint is shown immediately: animating
    // it in would mean the visitor watches content they can already see arrive.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.shown = "true";
          io.unobserve(el);
          // Release the compositor hint once the animation has finished.
          el.addEventListener(
            "animationend",
            () => {
              el.dataset.done = "true";
            },
            { once: true },
          );
        }
      },
      // Fire a little before the element is fully in view, so the motion has
      // finished by the time it reaches comfortable reading position.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      data-reveal=""
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
