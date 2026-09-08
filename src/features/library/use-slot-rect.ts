"use client";

import { useLayoutEffect, useState } from "react";

export type SlotRect = { top: number; left: number; width: number; height: number };

/**
 * The viewport rectangle of the registered slot, kept current.
 *
 * Re-measured on: the slot resizing, the document resizing (anything above the
 * slot changing height, e.g. an image loading), the window resizing, and any
 * scroll anywhere (captured at the window, so a scroll inside the app's own
 * frame counts too — the library page scrolls inside PageShell, not the
 * document). Reads are coalesced to one per animation frame.
 *
 * The first read is a layout effect so the frame is placed over the slot
 * before the browser paints: with a plain effect the dock painted one frame at
 * its parked corner and then slid up to the slot on every reload of the page.
 */
export function useSlotRect(el: HTMLElement | null): SlotRect | null {
  const [rect, setRect] = useState<SlotRect | null>(null);

  useLayoutEffect(() => {
    if (!el) {
      setRect(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      setRect((cur) => {
        const next = { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
        return cur && cur.top === next.top && cur.left === next.left && cur.width === next.width && cur.height === next.height ? cur : next;
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
    /*
     * The app is a fixed-height frame, so the document never resizes when the
     * content above the slot changes height — a web font swapping in, a label
     * appearing after its first render — and the observer on the document
     * says nothing. Fonts are the common case and get their own trigger; a
     * slow tick catches the rest at a cost of one rectangle read a few times
     * a second.
     */
    document.fonts?.ready.then(schedule).catch(() => {});
    const tick = setInterval(schedule, 250);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
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
