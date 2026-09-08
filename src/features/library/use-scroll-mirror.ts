"use client";

import { useEffect, useState } from "react";

/**
 * Makes a fixed, full-screen layer scroll in lockstep with the page's scroll
 * box — so that a wheel or a finger over the player frame moves the page.
 *
 * The frame is a cross-origin iframe and swallows its own wheel events; the
 * only way a wheel over it reaches the page is the browser's own scroll
 * chaining, which climbs from the frame to the nearest scrollable ANCESTOR.
 * The frame's ancestors are the player layer and <body>, neither of which
 * scrolls — so while docked the layer is given the page's scroll height and
 * lets the browser scroll it, and every scroll of either side is copied to
 * the other. The dock, absolutely positioned inside the layer, then travels
 * with the page content exactly like the slot under it. Laying a pane over
 * the frame to catch the wheel was tried first: it also caught the clicks,
 * and the scrubber and the fullscreen button under it went dead.
 *
 * Returns the height the layer's spacer must have; 0 when inactive.
 */
export function useScrollMirror(
  layer: HTMLElement | null,
  box: HTMLElement | null,
  active: boolean,
): number {
  const [spacer, setSpacer] = useState(0);

  useEffect(() => {
    if (!layer) return;
    if (!active || !box) {
      layer.style.overflowY = "hidden";
      setSpacer(0);
      return;
    }
    layer.style.overflowY = "auto";
    /*
     * Both scrollers must have the same travel. The layer is as tall as the
     * screen while the box may be shorter (an app header above it, a nav bar
     * below), so the spacer is the box's content plus that difference.
     */
    const size = () =>
      setSpacer(
        box.scrollHeight + Math.max(0, window.innerHeight - box.clientHeight),
      );
    size();
    layer.scrollTop = box.scrollTop;

    // Copying a position raises a scroll event on the other side, which would
    // copy it straight back; equal values make that a no-op.
    const fromBox = () => {
      if (layer.scrollTop !== box.scrollTop) layer.scrollTop = box.scrollTop;
    };
    const fromLayer = () => {
      if (box.scrollTop !== layer.scrollTop) box.scrollTop = layer.scrollTop;
    };
    box.addEventListener("scroll", fromBox, { passive: true });
    layer.addEventListener("scroll", fromLayer, { passive: true });
    const ro = new ResizeObserver(size);
    ro.observe(box);
    Array.from(box.children).forEach((c) => ro.observe(c));
    window.addEventListener("resize", size);
    return () => {
      box.removeEventListener("scroll", fromBox);
      layer.removeEventListener("scroll", fromLayer);
      ro.disconnect();
      window.removeEventListener("resize", size);
      layer.style.overflowY = "hidden";
    };
  }, [layer, box, active]);

  return spacer;
}
