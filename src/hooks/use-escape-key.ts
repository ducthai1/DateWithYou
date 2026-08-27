"use client";

import { useEffect } from "react";

/**
 * Run a handler when Escape is pressed, while `active`.
 *
 * For overlays that are not built on the shared <Modal>. Every dismissable
 * layer needs a keyboard way out: a backdrop you can only click is a dead end
 * for anyone not using a pointer, and "press Escape" is the one gesture people
 * try without being told.
 *
 * This covers dismissal only. <Modal> and <BottomSheet> also trap focus and
 * lock body scroll, which a hand-rolled overlay still will not do — prefer
 * those shells, and reach for this only where switching to one is not
 * practical.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}
