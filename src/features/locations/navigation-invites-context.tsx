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
import { useNavigationInvites } from "./use-navigation-invites";
import type { IncomingInvite, InviteResponse } from "./use-navigation-invites";

interface NavigationInvitesContextValue {
  incomingInvite: IncomingInvite | null;
  inviteResponse: InviteResponse | null;
  partnerPingAction: string | null;
  endedTrip: { id: string; locationName: string } | null;
  isConnected: boolean;
  clearIncoming: () => void;
  clearResponse: () => void;
  clearEndedTrip: () => void;
}

const NavigationInvitesContext =
  createContext<NavigationInvitesContextValue | null>(null);

export function NavigationInvitesProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Single hook call = single EventSource connection for the whole app tree.
  const value = useNavigationInvites();

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
