"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Where this tab has been, so a "back" link can name the place it goes to.
 *
 * The browser knows the previous entry but will not tell a page what it was,
 * so every "← Về trang chủ" on the site was a fixed link to `/` — someone who
 * came from the blog was sent to the landing page instead. This records each
 * route the tab visits (session-scoped, last dozen), and SmartBackLink reads
 * the previous distinct one.
 */
const KEY = "vivu:route-trail";
const MAX = 12;

/*
 * Routes that are one place with many addresses count as one step. The watch
 * page's URL changes with every track (a playlist pick, "next", the partner
 * skipping), and each would otherwise be its own step — so "back" from track
 * seven offered track six, and a dozen skips buried where the person had
 * actually come from.
 */
const FAMILIES = ["/library/phat/", "/library/luot/"];
function familyOf(path: string): string {
  const f = FAMILIES.find((p) => path.startsWith(p));
  return f ?? path;
}

export function readRouteTrail(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** The last route in this tab that is not `current`, if any. */
export function previousRoute(current: string): string | null {
  const trail = readRouteTrail();
  const family = familyOf(current);
  for (let i = trail.length - 1; i >= 0; i--)
    if (familyOf(trail[i]) !== family) return trail[i];
  return null;
}

export function RouteTrail() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    try {
      const trail = readRouteTrail();
      if (trail[trail.length - 1] === pathname) return;
      /*
       * A stack, not a log. Landing on the entry BEFORE the current one means
       * the reader went back, so that step is popped rather than appended —
       * otherwise the trail grows A,B,A,B and the back link on each page
       * offers the page you just returned from, so pressing back twice walks
       * in a circle instead of going further back.
       */
      const last = trail[trail.length - 1];
      if (trail.length >= 2 && trail[trail.length - 2] === pathname)
        trail.pop();
      // Same place, new address (one track to the next): the step is updated,
      // not repeated.
      else if (last !== undefined && familyOf(last) === familyOf(pathname))
        trail[trail.length - 1] = pathname;
      else trail.push(pathname);
      sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX)));
    } catch {
      /* private mode / storage disabled: the back link keeps its fallback */
    }
  }, [pathname]);
  return null;
}
