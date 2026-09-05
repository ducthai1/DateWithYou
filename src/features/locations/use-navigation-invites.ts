"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type Waypoint = {
  lat: number;
  lng: number;
  name: string;
  type: "partner_location" | "saved_place" | "custom";
  status: "pending" | "arrived";
};

export type IncomingInvite = {
  id: string;
  initiatorId: string;
  locationId: string;
  locationName: string;
  status: string;
  waypoints?: Waypoint[];
  merged?: boolean;
};

export type InviteResponse = {
  id: string;
  targetId: string;
  locationId: string;
  locationName: string;
  status: string;
  waypoints?: Waypoint[];
  merged?: boolean;
};

/**
 * Listens for navigation-invite events via Server-Sent Events.
 *
 * Unlike polling, SSE keeps a single persistent HTTP connection open.
 * The server only pushes data when something actually changes, so the client
 * does zero work until there's a real event. The native `EventSource` API
 * handles automatic reconnection on network failures.
 */
export type PartnerLive = {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speedKmH: number | null;
  accuracy: number | null;
  batteryLevel: number | null;
  updatedAt: string;
};

/**
 * @param enabled  Open the stream only where it is needed. The public marketing
 *   surface (landing, feature pages, blog) has no invites and no session, so a
 *   guest there would otherwise open an EventSource that the server rejects and
 *   the browser then retries on a back-off — pure waste on a page built to be
 *   light. Defaults to true so every existing caller is unchanged.
 */
export function useNavigationInvites(enabled = true) {
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(
    null,
  );
  const [inviteResponse, setInviteResponse] =
    useState<InviteResponse | null>(null);
  const [partnerPingAction, setPartnerPingAction] = useState<string | null>(null);
  /*
   * Where the partner is, pushed by the server rather than fetched.
   *
   * It lives on this hook because the tab has exactly one stream and this is
   * what owns it. useLiveNavigation reads it from the context above it and
   * folds it into its own partner state — so a screen learns the other person
   * moved without having written anything itself.
   */
  const [partnerLive, setPartnerLive] = useState<PartnerLive | null>(null);
  // Set when the partner ends a shared trip — drives the "stop too?" prompt.
  const [endedTrip, setEndedTrip] = useState<{ id: string; locationName: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    // Don't double-connect.
    if (esRef.current) return;

    const es = new EventSource("/api/navigation-invites/stream");
    esRef.current = es;

    es.addEventListener("heartbeat", () => {
      setIsConnected(true);
    });

    es.addEventListener("invite", (e) => {
      try {
        const data = JSON.parse(e.data) as IncomingInvite;
        setIncomingInvite(data);
      } catch {
        /* ignore malformed */
      }
    });

    // The pending invite went away (cancelled / responded elsewhere / expired) →
    // clear it so the incoming-invite modal dismisses instead of sticking around.
    es.addEventListener("invite-cancelled", () => {
      setIncomingInvite(null);
    });

    es.addEventListener("invite-response", (e) => {
      try {
        const data = JSON.parse(e.data) as InviteResponse;
        setInviteResponse(data);
      } catch {
        /* ignore malformed */
      }
    });

    es.addEventListener("partner-location", (e) => {
      try {
        setPartnerLive(JSON.parse(e.data) as PartnerLive);
      } catch {
        /* ignore malformed */
      }
    });

    // Their last fix aged out. Clearing beats leaving a pin at a place they
    // have not been for five minutes.
    es.addEventListener("partner-gone", () => setPartnerLive(null));

    es.addEventListener("ping", (e) => {
      try {
        const data = JSON.parse(e.data) as { action: string; ts: number };
        setPartnerPingAction(data.action);
        // Reset ping action state after a few seconds so it can be re-triggered
        setTimeout(() => setPartnerPingAction(null), 4000);
      } catch {
        /* ignore malformed */
      }
    });

    es.addEventListener("trip-ended", (e) => {
      try {
        const data = JSON.parse(e.data) as { id: string; locationName: string };
        setEndedTrip(data);
      } catch {
        /* ignore malformed */
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      // EventSource will auto-reconnect after a brief back-off.
    };

    es.onopen = () => {
      setIsConnected(true);
    };
  }, []);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setIsConnected(false);
  }, []);

  /** Dismiss the current incoming invite from state (after responding). */
  const clearIncoming = useCallback(() => setIncomingInvite(null), []);
  /** Dismiss the response state (after auto-navigating). */
  const clearResponse = useCallback(() => setInviteResponse(null), []);
  /** Dismiss the partner-ended-trip prompt (after the user decides). */
  const clearEndedTrip = useCallback(() => setEndedTrip(null), []);

  // Connect on mount, disconnect on unmount — but only where enabled.
  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
    /** The latest pending invite targeting this user (null = none). */
    incomingInvite,
    /** The latest response to an invite this user sent (null = none). */
    inviteResponse,
    /** The real-time ping action from partner. Reset automatically. */
    partnerPingAction,
    /** The partner's last known position, pushed over the stream. */
    partnerLive,
    /** Set when the partner ends a shared trip (null = none). */
    endedTrip,
    isConnected,
    clearIncoming,
    clearResponse,
    clearEndedTrip,
  };
}
