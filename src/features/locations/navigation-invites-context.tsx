"use client";

/**
 * NavigationInvitesProvider — mounts exactly ONE SSE connection per tab for
 * navigation invite events. Both GlobalInviteListener and LocationsPage consume
 * this context instead of each opening their own EventSource.
 *
 * Without this, two independent useNavigationInvites() calls produce two
 * persistent connections to /api/navigation-invites/stream, and competing
 * invite-response handlers can race each other.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { isPublicChrome } from "@/components/layout/nav-items";
import { useNavigationInvites } from "./use-navigation-invites";

/*
 * Derived from the hook, not written out beside it.
 *
 * This was a hand-kept copy of the same shape, so anything added to the hook
 * was invisible here until someone remembered to add it twice — which is
 * exactly how the partner's live position reached the tab and stopped at this
 * line.
 */
type NavigationInvitesContextValue = ReturnType<typeof useNavigationInvites>;

const NavigationInvitesContext =
  createContext<NavigationInvitesContextValue | null>(null);

export function NavigationInvitesProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Single hook call = single EventSource connection for the whole app tree —
  // and none at all on the public marketing surface, where there is no session
  // to authorise the stream.
  const pathname = usePathname();
  const value = useNavigationInvites(!isPublicChrome(pathname));

  return (
    <NavigationInvitesContext.Provider value={value}>
      {children}
    </NavigationInvitesContext.Provider>
  );
}

/** Consume the shared navigation-invites SSE state. Must be used inside NavigationInvitesProvider. */
export function useNavigationInvitesContext(): NavigationInvitesContextValue {
  const ctx = useContext(NavigationInvitesContext);
  if (!ctx) {
    throw new Error(
      "useNavigationInvitesContext must be used within NavigationInvitesProvider",
    );
  }
  return ctx;
}
