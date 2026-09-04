"use client";

import { useEffect } from "react";

/**
 * Leaves fullscreen the moment the app is looked at again.
 *
 * On an Android home-screen install, a fullscreen video that went into the
 * system's picture-in-picture and then lost it — the clip ended, or the small
 * window was tapped — left the app stuck on its launch splash when reopened,
 * until it was force-closed. The one state that had changed in the meantime is
 * fullscreen: the frame that owned it is gone, yet the document still says it
 * is fullscreen, and Chrome tries to bring that back. Dropping fullscreen on
 * the way back in gives it nothing to restore.
 *
 * The cost is that a fullscreen video does not come back fullscreen after an
 * app switch — it comes back on the page, which is also where the small
 * window's "open" button promises to land.
 */
export function FullscreenRecovery() {
  useEffect(() => {
    const leave = () => {
      if (document.visibilityState !== "visible") return;
      if (!document.fullscreenElement) return;
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
