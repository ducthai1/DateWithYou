"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mapTileAssetUrls } from "@/lib/map-tile-assets";

/**
 * Loads the map ahead of being asked for it.
 *
 * Opening the map used to start from nothing: a 267 KB bundle, then a style, a
 * sprite and six font files, then tiles — strictly in that order, because each
 * step only knows what to ask for once the one before it has landed. On a phone
 * that was several seconds of watching a loading message, every single time.
 *
 * None of that work depends on being on the map screen, so it happens here
 * instead, on whatever page the person is already reading. By the time they tap
 * the map, the bundle is parsed and the tile assets are in cache, and the
 * screen has nothing left to wait for. The service worker keeps them, so this
 * costs its download once rather than once per visit.
 *
 * Held back until the page has finished loading and the main thread is free, so
 * it never competes with the screen actually in front of someone. Skipped
 * entirely on a metered or very slow connection, where spending ~700 KB on a
 * screen that may never be opened is the wrong trade.
 *
 * And skipped on the map itself, where there is nothing left to prepare. Warming
 * there is not merely redundant: it asks for the very bytes the visible map is
 * queuing for, on a link that is already saturated, and measured 26s to draw
 * instead of 2s.
 */
export function WarmMapAssets() {
  const pathname = usePathname();
  const onMap = pathname?.startsWith("/map") ?? false;

  useEffect(() => {
    if (onMap) return;
    let cancelled = false;

    const warm = () => {
      if (cancelled) return;
      const conn = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (conn?.saveData) return;
      if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

      // The bundle first: it is the long pole, and the tile assets cannot be
      // used until something is there to use them.
      void import("@/features/locations/location-mapview").catch(() => {});
      for (const url of mapTileAssetUrls(window.devicePixelRatio || 1)) {
        fetch(url, { mode: "cors" }).catch(() => {});
      }
    };

    const schedule = () => {
      const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
        .requestIdleCallback;
      if (ric) ric(warm, { timeout: 4000 });
      else setTimeout(warm, 1500);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
    };
  }, [onMap]);

  return null;
}
