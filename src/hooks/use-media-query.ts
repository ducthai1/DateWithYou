"use client";

import { useEffect, useState } from "react";

/**
 * Reactive media-query match. SSR-safe: the lazy initializer returns false on
 * the server, then the effect syncs the real value after mount. Consumers that
 * render during SSR must only use the result for behavior that doesn't change
 * markup on first paint (e.g. a guarded `mounted && isMobile`), to avoid
 * hydration mismatches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True on phone-width viewports (below Tailwind's `md` breakpoint = 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
