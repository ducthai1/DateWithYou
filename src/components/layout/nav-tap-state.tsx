"use client";

import { useLinkStatus } from "next/link";

/**
 * "Is this nav item the one the person is on — or the one they just tapped?"
 *
 * The nav used to answer only the first half, from `usePathname()`. That value
 * changes when the navigation COMMITS, and every route in this app is
 * server-rendered per request (the root layout reads the theme and tone
 * cookies), so on a phone the tapped tab stayed grey for the length of a round
 * trip. Measured on a production build at 150ms RTT: 207–298ms before the tab
 * lit up, and 723ms for /home. The owner's words: "I press it and it takes a
 * moment before the tab activates — if it is going to show a loading state
 * anyway, let it switch immediately".
 *
 * `useLinkStatus()` is the missing half. It reports the pending state of the
 * enclosing `<Link>` from the moment it is clicked until the navigation
 * settles, which is exactly the gap. Treating pending as active makes the tap
 * land on the tab itself, with no network in the path at all.
 *
 * MUST be called from a component rendered INSIDE the `<Link>` — that is how
 * the hook finds which link it belongs to. Hence this file: a hook plus the
 * tiny wrapper that makes "inside the link" easy to arrange.
 */
export function useNavItemActive(active: boolean): boolean {
  const { pending } = useLinkStatus();
  return active || pending;
}

/**
 * Renders its children with the answer, so a nav item can keep its markup in
 * one place instead of splitting into a component per shape.
 *
 * Both navs use it the same way:
 *
 *   <Link href={...}><NavItemState active={onThisRoute}>{(on) => …}</NavItemState></Link>
 */
export function NavItemState({
  active,
  children,
}: {
  active: boolean;
  children: (isActive: boolean) => React.ReactNode;
}) {
  const isActive = useNavItemActive(active);
  return <>{children(isActive)}</>;
}
