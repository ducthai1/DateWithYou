"use client";

import { useEffect } from "react";

/**
 * Registers the tile-asset cache from `public/sw.js`.
 *
 * Kept off the render path entirely — it runs after load and fails silently by
 * design, because everything it caches also works without it. No service-worker
 * support, a private window, or a blocked registration all just fall back to
 * the plain network path.
 */
export function RegisterMapCache() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    // Registering would otherwise compete for bandwidth with the page that is
    // still loading — the exact thing this cache exists to speed up.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
