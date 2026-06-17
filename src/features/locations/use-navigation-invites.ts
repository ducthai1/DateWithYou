"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type IncomingInvite = {
  id: string;
  initiatorId: string;
  locationId: string;
  locationName: string;
  status: string;
};

export type InviteResponse = {
  id: string;
  targetId: string;
  locationId: string;
  locationName: string;
  status: string;
};

/**
 * Listens for navigation-invite events via Server-Sent Events.
 *
 * Unlike polling, SSE keeps a single persistent HTTP connection open.
 * The server only pushes data when something actually changes, so the client
 * does zero work until there's a real event. The native `EventSource` API
 * handles automatic reconnection on network failures.
 */
export function useNavigationInvites() {
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(
    null,
  );
  const [inviteResponse, setInviteResponse] =
    useState<InviteResponse | null>(null);
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

    es.addEventListener("invite-response", (e) => {
      try {
        const data = JSON.parse(e.data) as InviteResponse;
        setInviteResponse(data);
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

  // Connect on mount, disconnect on unmount.
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    /** The latest pending invite targeting this user (null = none). */
    incomingInvite,
    /** The latest response to an invite this user sent (null = none). */
    inviteResponse,
    isConnected,
    clearIncoming,
    clearResponse,
  };
}
