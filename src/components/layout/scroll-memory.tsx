"use client";

import { useEffect, useRef } from "react";
import { parseSavedScroll, scrollToRestore, type SavedScroll } from "@/lib/scroll-memory";

const KEY = "vivu:scroll";
const GIVE_UP_MS = 5000;

/*
 * Only the first scroll box mounted after a document load may restore: a later
 * client-side navigation in the same document is not a reload. The flag is
 * handed back if the attempt is torn down unfinished, because StrictMode mounts,
 * unmounts and mounts again — set for good on the first mount, the second
 * would find it taken and never restore.
 */
let claimed = false;

/**
 * Put inside a scroll box (PageShell does): saves the box's position as the tab
 * leaves the page and restores it after a reload of the same address.
 */
export function ScrollMemory() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box) return;
    const here = () => window.location.pathname + window.location.search;

    // pagehide fires on reload, on closing the tab and on iOS pull-to-refresh.
    const save = () => {
      try {
        const v: SavedScroll = { href: here(), top: Math.round(box.scrollTop) };
        sessionStorage.setItem(KEY, JSON.stringify(v));
      } catch {
        /* storage disabled: reloads start at the top, as before */
      }
    };
    window.addEventListener("pagehide", save);

    let stop: (() => boolean) | null = null;
    if (!claimed) {
      claimed = true;
      let saved: SavedScroll | null = null;
      try {
        saved = parseSavedScroll(sessionStorage.getItem(KEY));
      } catch {
        /* storage disabled */
      }
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const top = scrollToRestore(saved, here(), nav?.type);
      if (top !== null) stop = holdScrollAt(box, top);
    }

    return () => {
      window.removeEventListener("pagehide", save);
      if (stop && !stop()) claimed = false;
    };
  }, []);

  return <span ref={ref} hidden />;
}

/*
 * The content arrives in pieces — skeletons, the first query, then images — so
 * a single scrollTop assignment lands short of where the page used to be. It is
 * re-applied on every size change until it sticks, the person scrolls on their
 * own, or GIVE_UP_MS passes. Driven by ResizeObserver, not requestAnimationFrame,
 * which does not run in a page that is not being painted.
 *
 * Returns a stopper that reports whether the restore had already finished.
 */
function holdScrollAt(box: HTMLElement, top: number): () => boolean {
  let finished = false;
  const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const ro = new ResizeObserver(() => apply());
  const timer = window.setTimeout(() => finish(), GIVE_UP_MS);

  function finish() {
    finished = true;
    ro.disconnect();
    window.clearTimeout(timer);
    for (const e of inputs) box.removeEventListener(e, finish);
  }
  function apply() {
    if (finished) return;
    box.scrollTop = top;
    if (Math.abs(box.scrollTop - top) < 2) finish();
  }

  for (const child of Array.from(box.children)) ro.observe(child);
  for (const e of inputs) box.addEventListener(e, finish, { passive: true });
  apply();

  return () => {
    const done = finished;
    finish();
    return done;
  };
}
