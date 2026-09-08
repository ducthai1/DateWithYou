"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Where the slot is, in the coordinates the player layer uses.
 *
 * `box` is the page's own scroll box (PageShell's), or null on a page that
 * does not scroll. With a box, `top` is measured in that box's CONTENT space
 * — from the top of the scrolled content, not of the screen — and `boxTop` is
 * where the box itself starts on screen. The layer over the page scrolls in
 * step with the box (see use-scroll-mirror), so a panel placed at
 * `boxTop + top` inside it sits on the slot at every scroll position without
 * being re-measured while the page moves. Without a box the numbers are plain
 * viewport coordinates and `boxTop` is 0.
 */
export type SlotRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  boxTop: number;
  box: HTMLElement | null;
};

/**
 * The nearest ancestor of `el` that is a vertical scroll container — the
 * page's own scroll box, not the document, which the app never lets scroll.
 * Chosen by its overflow style, not by whether it overflows right now: a page
 * that grows past the fold a moment later must not change its answer.
 */
export function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * The slot's rectangle, kept current.
 *
 * Re-measured on: the slot resizing, the window resizing, any scroll anywhere
 * (captured at the window — a sticky slot moves through content space while
 * the page scrolls), fonts arriving, and a slow tick for everything else. The
 * app is a fixed-height frame, so the document never resizes when content
 * above the slot changes height and nothing but the tick would notice.
 * Reads are coalesced to one per animation frame; unchanged values are not
 * re-set. The first read is a layout effect so the frame is placed before the
 * browser paints — a plain effect showed the dock at its parked corner for a
 * frame on every reload of the page.
 */
export function useSlotRect(el: HTMLElement | null): SlotRect | null {
  const [rect, setRect] = useState<SlotRect | null>(null);

  useLayoutEffect(() => {
    if (!el) {
      setRect(null);
      return;
    }
    const box = scrollParentOf(el);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const b = box?.getBoundingClientRect();
      const boxTop = b ? Math.round(b.top) : 0;
      const top =
        b && box
          ? Math.round(r.top - b.top + box.scrollTop)
          : Math.round(r.top);
      setRect((cur) => {
        const next = {
          top,
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
          boxTop,
          box,
        };
        return cur &&
          cur.top === next.top &&
          cur.left === next.left &&
          cur.width === next.width &&
          cur.height === next.height &&
          cur.boxTop === next.boxTop &&
          cur.box === next.box
          ? cur
          : next;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    ro.observe(document.documentElement);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    document.fonts?.ready.then(schedule).catch(() => {});
    const tick = setInterval(schedule, 250);
    return () => {
      clearInterval(tick);
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
    };
  }, [el]);

  return rect;
}
