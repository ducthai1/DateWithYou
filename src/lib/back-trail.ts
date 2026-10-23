import { pathOf } from "@/lib/url-query";

/**
 * Where this tab has been, so a "back" link can name — and return to — the
 * place it goes to. Read by `previousRoute` and SmartBackLink, written by
 * RouteTrail on every route change and by `replaceQuery` when a screen moves
 * its own state into the query string.
 *
 * Entries are full hrefs (path + query), not bare paths. With bare paths the
 * back link out of the player returned to `/library` and the library opened on
 * its first tab, not the one the person had come from. Every comparison that
 * decides what counts as a new STEP still looks at the path only: changing tab
 * on one page is the same place with a new address, not somewhere new.
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

export function familyOf(href: string): string {
  const path = pathOf(href);
  return FAMILIES.find((p) => path.startsWith(p)) ?? path;
}

/** The trail after visiting `href`. Pure; the caller stores it. */
export function stepTrail(trail: readonly string[], href: string): string[] {
  const next = [...trail];
  const last = next[next.length - 1];
  if (last === href) return next;

  if (last !== undefined && familyOf(last) === familyOf(href)) {
    // Same place, new address — another tab, another track: update the step.
    next[next.length - 1] = href;
  } else if (next.length >= 2 && pathOf(next[next.length - 2]) === pathOf(href)) {
    /*
     * A stack, not a log. Landing on the entry BEFORE the current one means
     * the reader went back, so that step is popped rather than appended —
     * otherwise the trail grows A,B,A,B and the back link on each page offers
     * the page you just returned from, so pressing back twice walks in a
     * circle instead of going further back.
     */
    next.pop();
    next[next.length - 1] = href;
  } else {
    next.push(href);
  }
  return next.slice(-MAX);
}

export function readBackTrail(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Record that the tab is now at `href`. */
export function noteVisit(href: string): void {
  try {
    const trail = readBackTrail();
    const next = stepTrail(trail, href);
    if (next.length !== trail.length || next.some((h, i) => h !== trail[i]))
      sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage disabled: the back link keeps its fallback */
  }
}

/** The last place in this tab that is not `current`, with its query. */
export function previousRoute(current: string): string | null {
  const trail = readBackTrail();
  const family = familyOf(current);
  for (let i = trail.length - 1; i >= 0; i--)
    if (familyOf(trail[i]) !== family) return trail[i];
  return null;
}
