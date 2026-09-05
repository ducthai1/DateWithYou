"use client";

import { useEffect } from "react";
import { isStandalone } from "@/lib/push-subscribe";

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
      const el = document.fullscreenElement;
      if (!el) return;
      /*
       * Fullscreen owned by an embedded frame — a YouTube clip the person put
       * fullscreen, sent to PiP, then came back from — is the case that still
       * left the installed app on its splash after the exit alone. That splash
       * is a WebAPK layer that covers the web contents "till the page has
       * finished loading", and a page that loaded long ago never sends that
       * again. A reload does. The clip is already gone at this point, so the
       * reload costs nothing that was still playing.
       */
      const fromEmbed = el.tagName === "IFRAME";
      document.exitFullscreen().catch(() => undefined).finally(() => {
        if (fromEmbed && isStandalone()) window.location.reload();
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
