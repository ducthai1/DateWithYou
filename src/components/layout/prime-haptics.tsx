"use client";

import { useEffect } from "react";
import { primeHaptics } from "@/lib/haptics";
import { loadVoicePreference, primeSpeech } from "@/lib/speak";

/**
 * Gets the haptic and audio paths ready during the first tap of the visit.
 *
 * iOS will not let a page create a usable AudioContext outside a user gesture,
 * its switch haptic is happiest once one has already been toggled inside one,
 * and its speech engine drops the first utterance spoken outside one. None of
 * the three can be arranged at the moment a ping arrives or a turn comes up —
 * that is the whole problem — so the groundwork happens on the first touch,
 * whatever it was for.
 */
export function PrimeHaptics() {
  useEffect(() => {
    const prime = () => {
      primeHaptics();
      // Same constraint, same one chance: iOS drops the first utterance made
      // outside a gesture and can leave the queue wedged afterwards.
      primeSpeech();
    };
    loadVoicePreference();
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
