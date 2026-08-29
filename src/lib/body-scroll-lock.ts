"use client";

import { useEffect } from "react";

/**
 * One body scroll lock, counted, shared by every dialog.
 *
 * Modal and BottomSheet each used to save `document.body.style.overflow` on
 * open and put it back on close. That is correct for one dialog and wrong the
 * moment two overlap, which this app does often — a confirm over a form, a
 * form over a sheet, a picker over a detail:
 *
 *   A opens   -> saves "",       sets hidden
 *   B opens   -> saves "hidden", sets hidden      (B captured A's lock)
 *   A closes  -> restores ""                      (scroll returns under B)
 *   B closes  -> restores "hidden"                (locked, with nothing open)
 *
 * The last line is the bug people hit: scrolling stops working and only
 * reloading the app clears it, because nothing is left on screen to close.
 *
 * A counter fixes the ordering: the first lock captures the real value, the
 * last release puts it back, and everything in between is a no-op.
 */

let depth = 0;
let saved: string | null = null;

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (depth === 0) {
    const current = document.body.style.overflow;
    /*
     * Never remember "hidden" as the value to go back to. Nothing in this app
     * sets it except this module, so seeing it here means a previous build
     * leaked one — and faithfully restoring it would carry that stuck state
     * forward across every future dialog instead of ending it.
     */
    saved = current === "hidden" ? "" : current;
    document.body.style.overflow = "hidden";
  }
  depth += 1;
}

export function releaseBodyScroll() {
  if (typeof document === "undefined") return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) {
    document.body.style.overflow = saved ?? "";
    saved = null;
  }
}

/** Hold the lock for as long as `active` is true. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return releaseBodyScroll;
  }, [active]);
}
