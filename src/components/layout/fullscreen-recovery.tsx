"use client";

import { useEffect } from "react";

/**
 * Leaves the app's own fullscreen when the app is looked at again.
 *
 * The navigation overlay puts the whole document fullscreen for a ride (so
 * Android can float the mini window on Home). When that window is gone the
 * document still reports fullscreen, and Chrome tries to restore it on the way
 * back; dropping it here gives it nothing to restore.
 *
 * It touches ONLY fullscreen owned by the app (documentElement). Fullscreen
 * owned by an <iframe> is YouTube's — the person put a clip fullscreen and sent
 * it to picture-in-picture. Chrome is mid-animation bringing that back when the
 * app returns; calling exitFullscreen into it made the screen flash and close,
 * and reloading afterwards left the installed app stuck on its splash. Both of
 * those were this code doing too much. That case is left entirely to Chrome now.
 */
export function FullscreenRecovery() {
  useEffect(() => {
    const leave = () => {
      if (document.visibilityState !== "visible") return;
      const el = document.fullscreenElement;
      if (!el || el.tagName === "IFRAME") return;
      document.exitFullscreen().catch(() => {
        /* Already out, or not allowed right now — nothing else to do. */
      });
    };
    document.addEventListener("visibilitychange", leave);
    window.addEventListener("pageshow", leave);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      window.removeEventListener("pageshow", leave);
    };
  }, []);
  return null;
}
