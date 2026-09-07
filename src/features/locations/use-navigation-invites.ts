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

/** A track as it travels over the stream — same shape the session stores. */
export type ListenTrack = {
  id: string;
  kind: string;
  title: string;
  thumbnailUrl: string | null;
  providerLabel: string;
  provider: string;
  embedUrl: string;
};

/** "Nghe cùng nhau?" — waiting on this user to answer. */
export type ListenInvite = { id: string; hostId: string; title: string };

/** The server sends a heartbeat at least every 15 s; three missed is dead. */
const STREAM_SILENCE_MS = 45_000;
const STREAM_WATCHDOG_MS = 10_000;

/**
 * What the other person just did to the shared playback.
 *
 * `stateAgeMs` is how long ago it was true, measured on the SERVER, and
 * `receivedAt` is when this device saw it. A follower works out where to be
 * from those two and never from a timestamp, because the two phones in a space
 * do not agree about what time it is.
 */
export type ListenState = {
  id: string;
  queue: ListenTrack[];
  index: number;
  isPlaying: boolean;
  positionSec: number;
  stateAgeMs: number;
  updatedBy: string;
  receivedAt: number;
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
  // ── Shared listening ──
  const [listenInvite, setListenInvite] = useState<ListenInvite | null>(null);
  const [listenState, setListenState] = useState<ListenState | null>(null);
  /** Session id while one is live, else null. */
  const [listenLive, setListenLive] = useState<string | null>(null);
  /*
   * The id of the session that ended, kept rather than just clearing the one
   * above. On mount `listenLive` is already null, so a consumer cannot tell
   * "nothing has happened yet" from "it just ended" — and one seeded from a
   * load-time query would wipe itself the moment it mounted.
   */
  const [listenEnded, setListenEnded] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  /*
   * When the server was last heard from, on any event including the heartbeat
   * it sends every 15 s. A connection the phone carried from Wi-Fi onto 4G is
   * dead without ever saying so: `readyState` stays OPEN, no error fires, and
   * the browser has nothing to retry. Silence is the only symptom, so silence
   * is what is watched.
   */
  const lastEventAtRef = useRef(0);

  const connect = useCallback(() => {
    // Don't double-connect.
    if (esRef.current) return;

    const es = new EventSource("/api/navigation-invites/stream");
    esRef.current = es;
    lastEventAtRef.current = Date.now();
    // Every named event goes through here so the watchdog sees all of them.
    const on = (name: string, fn: (e: MessageEvent) => void) =>
      es.addEventListener(name, (e) => {
        lastEventAtRef.current = Date.now();
        fn(e as MessageEvent);
      });

    on("heartbeat", () => {
      setIsConnected(true);
    });

    on("invite", (e) => {
      try {
        const data = JSON.parse(e.data) as IncomingInvite;
        setIncomingInvite(data);
      } catch {
        /* ignore malformed */
      }
    });

    // The pending invite went away (cancelled / responded elsewhere / expired) →
    // clear it so the incoming-invite modal dismisses instead of sticking around.
    on("invite-cancelled", () => {
      setIncomingInvite(null);
    });

    on("invite-response", (e) => {
      try {
        const data = JSON.parse(e.data) as InviteResponse;
        setInviteResponse(data);
      } catch {
        /* ignore malformed */
      }
    });

    on("partner-location", (e) => {
      try {
        setPartnerLive(JSON.parse(e.data) as PartnerLive);
      } catch {
        /* ignore malformed */
      }
    });

    // Their last fix aged out. Clearing beats leaving a pin at a place they
    // have not been for five minutes.
    on("partner-gone", () => setPartnerLive(null));

    on("ping", (e) => {
      try {
        const data = JSON.parse(e.data) as { action: string; ts: number };
        setPartnerPingAction(data.action);
        // Reset ping action state after a few seconds so it can be re-triggered
        setTimeout(() => setPartnerPingAction(null), 4000);
      } catch {
        /* ignore malformed */
      }
    });

    on("listen-invite", (e) => {
      try {
        setListenInvite(JSON.parse(e.data) as ListenInvite);
      } catch {
        /* ignore malformed */
      }
    });

    on("listen-started", (e) => {
      try {
        const data = JSON.parse(e.data) as { id: string };
        setListenLive(data.id);
        // The invite has been answered; the card must not linger behind it.
        setListenInvite(null);
      } catch {
        /* ignore malformed */
      }
    });

    on("listen-ended", (e) => {
      /*
       * Suffixed with the arrival time so two ends of sessions that happened
       * to share an id still read as two events. Equal values are what React
       * calls "no change", and an effect keyed on this would not have run.
       */
      try {
        const data = JSON.parse(e.data) as { id: string };
        setListenEnded(`${data.id}@${Date.now()}`);
      } catch {
        setListenEnded(`unknown@${Date.now()}`);
      }
      setListenLive(null);
      setListenInvite(null);
      setListenState(null);
    });

    on("listen-state", (e) => {
      try {
        const data = JSON.parse(e.data) as Omit<ListenState, "receivedAt">;
        // Stamped on arrival: the drift correction needs to know how much
        // longer has passed since the server measured the age.
        setListenState({ ...data, receivedAt: Date.now() });
      } catch {
        /* ignore malformed */
      }
    });

    on("trip-ended", (e) => {
      try {
        const data = JSON.parse(e.data) as { id: string; locationName: string };
        setEndedTrip(data);
      } catch {
        /* ignore malformed */
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      /*
       * EventSource retries on its own only while the connection is merely
       * broken. A non-200 answer (a 401 during a deploy, a 500 from a database
       * blip) or an iOS background kill leaves it CLOSED for good, silently —
       * and a stream that is closed for good means the other person can accept,
       * pause and skip forever without this tab ever hearing it. Reopen it.
       */
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null;
        setTimeout(() => {
          if (!esRef.current) connect();
        }, 3000);
      }
    };

    es.onopen = () => {
      lastEventAtRef.current = Date.now();
      setIsConnected(true);
    };
  }, []);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setIsConnected(false);
  }, []);

  /** Throw the current connection away and open a fresh one. */
  const reopen = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  /*
   * Two reasons to reopen that `onerror` never reports.
   *
   * Silence: the server sends something at least every 15 s, so three missed
   * beats mean the connection is gone even though the socket still says OPEN.
   * And the network coming back: the OS `online` event after a Wi-Fi → 4G
   * switch is the moment the old socket became certainly useless and a new one
   * can certainly be made; waiting for the watchdog would cost up to 45 s of
   * not hearing the other person.
   */
  useEffect(() => {
    if (!enabled) return;
    const watchdog = setInterval(() => {
      if (!esRef.current) return;
      if (Date.now() - lastEventAtRef.current > STREAM_SILENCE_MS) reopen();
    }, STREAM_WATCHDOG_MS);
    let settle: ReturnType<typeof setTimeout> | null = null;
    const onOnline = () => {
      if (settle) clearTimeout(settle);
      // The radio reports "online" a beat before packets flow.
      settle = setTimeout(reopen, 500);
    };
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(watchdog);
      if (settle) clearTimeout(settle);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, reopen]);

  /** Dismiss the current incoming invite from state (after responding). */
  const clearIncoming = useCallback(() => setIncomingInvite(null), []);
  /** Dismiss the response state (after auto-navigating). */
  const clearResponse = useCallback(() => setInviteResponse(null), []);
  /** Dismiss the partner-ended-trip prompt (after the user decides). */
  const clearEndedTrip = useCallback(() => setEndedTrip(null), []);
  /** Dismiss the listen invite card (after responding). */
  const clearListenInvite = useCallback(() => setListenInvite(null), []);
  /** Local end: forget the session without waiting for the stream to say so. */
  const clearListen = useCallback(() => {
    setListenLive(null);
    setListenState(null);
    setListenInvite(null);
  }, []);

  // Connect on mount, disconnect on unmount — but only where enabled.
  useEffect(() => {
    if (!enabled) return;
    connect();
    // A tab coming back from the background often finds its stream dead with
    // no error having fired. Check on return and reopen if so.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
        esRef.current = null;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      disconnect();
    };
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
    /** A pending "listen together?" aimed at this user (null = none). */
    listenInvite,
    /** Session id while one is live, else null. */
    listenLive,
    /** Set to the id of a session the stream reported as finished. */
    listenEnded,
    /** The partner's latest playback state (never an echo of our own). */
    listenState,
    isConnected,
    clearIncoming,
    clearResponse,
    clearEndedTrip,
    clearListenInvite,
    clearListen,
  };
}
