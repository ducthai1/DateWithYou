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
 *
 * Nothing here sets `will-change`: the browser promotes an element for the
 * duration of a transform/opacity animation by itself, and hinting it up front
 * for every reveal on the page just holds layers alive that are not animating.
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
  // "nav" is here for the sibling-page link list on the feature pages: a
  // list of links to other pages is a navigation landmark, not a section.
  as?: "div" | "li" | "section" | "nav";
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
          io.unobserve(el);
          /*
           * Start on a frame boundary rather than inside the observer callback.
           * That callback runs as part of the browser's scroll work, so writing
           * there kicks off an animation and its first style recalculation in
           * the middle of a frame that is already busy.
           *
           * Honest note: this measured neutral in a scripted-wheel harness —
           * synthetic scrolling leaves idle gaps between steps that a real
           * finger does not, so the harness cannot see the difference. Kept
           * because it is structurally the right place for the write, and it
           * costs a frame nobody can perceive.
           */
          requestAnimationFrame(() => {
            el.dataset.shown = "true";
          });
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
