"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { noteVisit, previousRoute, readBackTrail } from "@/lib/back-trail";

/**
 * Where this tab has been, so a "back" link can name the place it goes to.
 *
 * The browser knows the previous entry but will not tell a page what it was,
 * so every "← Về trang chủ" on the site was a fixed link to `/` — someone who
 * came from the blog was sent to the landing page instead. This records each
 * route the tab visits (session-scoped, last dozen), and SmartBackLink reads
 * the previous distinct one. The stepping rules live in `@/lib/back-trail`.
 */

export { previousRoute };
export const readRouteTrail = readBackTrail;

export function RouteTrail() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    // The query is read from the live URL: by the time this runs it already
    // belongs to the new route, and it is what a return trip should restore.
    noteVisit(pathname + window.location.search);
  }, [pathname]);
  return null;
}
