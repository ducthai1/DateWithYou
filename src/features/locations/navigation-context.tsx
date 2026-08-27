"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useLiveNavigation, type LiveNavigation } from "./use-live-navigation";
import type { LatLng } from "@/lib/maps";

/**
 * Holds live navigation above the router, so walking somewhere does not depend
 * on staying on the map page.
 *
 * Before this, `useLiveNavigation` was called inside `LocationsPage` and
 * nowhere else. Opening the wheel or a saved place mid-journey unmounted it,
 * which cleared the `watchPosition` watcher, released the wake lock and stopped
 * the partner pings — navigation did not merely go out of sight, it ended, and
 * the screen was free to sleep on someone in the middle of a street.
 *
 * Re-routing stays behind. Deciding what to do when someone leaves the route
 * needs the map page's own state — which leg is active, what is selected, the
 * query client — so the page registers a handler here instead of that logic
 * moving up. The hook already keeps its options in a ref, so swapping the
 * handler never restarts the watcher.
 */

type NavigationContextValue = LiveNavigation & {
  /**
   * Register what should happen when the walker leaves the route. Returns an
   * unsubscribe so an unmounting page cannot keep answering.
   */
  setOffRouteHandler: (fn: ((geo: LatLng) => void) | null) => () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const offRouteRef = useRef<((geo: LatLng) => void) | null>(null);

  const nav = useLiveNavigation({
    onOffRoute: (geo) => offRouteRef.current?.(geo),
  });

  const setOffRouteHandler = useCallback((fn: ((geo: LatLng) => void) | null) => {
    offRouteRef.current = fn;
    return () => {
      // Only clear if it is still ours — a page that mounts before the previous
      // one has finished unmounting would otherwise wipe the live handler.
      if (offRouteRef.current === fn) offRouteRef.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({ ...nav, setOffRouteHandler }),
    [nav, setOffRouteHandler],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation phải nằm trong <NavigationProvider>");
  return ctx;
}
