"use client";

import { useEffect } from "react";
import { primeHaptics } from "@/lib/haptics";

/**
 * Gets the haptic and audio paths ready during the first tap of the visit.
 *
 * iOS will not let a page create a usable AudioContext outside a user gesture,
 * and its switch haptic is happiest once one has already been toggled inside
 * one. Neither can be arranged at the moment a ping arrives — that is the whole
 * problem — so the groundwork happens on the first touch, whatever it was for.
 */
export function PrimeHaptics() {
  useEffect(() => {
    const prime = () => primeHaptics();
    // `once` on both: after the first of either, there is nothing left to do.
    window.addEventListener("pointerdown", prime, { once: true, passive: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);
  return null;
}
