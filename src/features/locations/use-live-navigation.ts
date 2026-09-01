import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/maps";
import { trpc } from "@/lib/trpc";
import type { Maneuver } from "@/lib/maneuver-vi";
/* Geometry lives in its own module so it can be checked without React — see
 * route-geometry.ts. The windowed match there is 9x cheaper than the full scan
 * this hook used to run on every GPS fix, and returns identical numbers. */
import { cumulativeMetres, remainingAlongRoute } from "@/lib/route-geometry";

/** How long the emotion buttons stay refused after one is sent. */
const PING_COOLDOWN_MS = 2500;

/** Why a ping did or did not go out — the UI needs the distinction. */
export type PingResult = "sent" | "too-soon" | "no-location";

export type PartnerLocation = {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speedKmH: number | null;
  accuracy: number | null;
  batteryLevel: number | null;
  pingAction: string | null;
  updatedAt: Date;
};

/** Partner link health derived from ping freshness + GPS accuracy.
 *  "stale" = no fresh ping (lost network/GPS); "weak" = online but poor fix. */
export type PartnerConnection = "online" | "stale" | "weak";

/** No fresh partner ping within this window → treated as disconnected. */
const PARTNER_STALE_MS = 20_000;
/** Horizontal GPS accuracy worse than this (metres) → "weak GPS". */
const WEAK_ACCURACY_M = 50;
/** No new GPS fix within this window while navigating → "lost GPS". Kept short
 *  (fixes normally arrive every 1-2s) so turning location off surfaces fast.
 *  Catches the silent-stall case where watchPosition fires no error. */
const GPS_STALE_MS = 4_000;
/** How often own-GPS / partner staleness is re-evaluated between events. */
const STALE_TICK_MS = 1_500;

/** Minimal screen Wake Lock shape (avoids relying on lib.dom typings). */
type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

export type LegInfo = {
  distanceMeters: number;
  durationSeconds: number;
  /** The turn list for this leg, when the router supplied one. */
  maneuvers?: Maneuver[];
  // `type` is a plain string (not the "LineString" literal) so a leg returned
  // straight from the tRPC route query assigns without a cast.
  geometry: { type: string; coordinates: Array<[number, number]> };
};

export type LiveNavigation = {
  /**
   * Horizontal GPS accuracy in metres, or null before the first fix.
   *
   * Was already measured and pinged to the server but never exposed here, so
   * the map had no way to draw it — which is why what it drew instead was a
   * fixed-size pulse that looked like an accuracy circle without being one.
   */
  accuracyM: number | null;
  isNavigating: boolean;
  /** Latest live position (null until the first fix). */
  userGeo: LatLng | null;
  /** Device heading in degrees (0 = north, 90 = east). null when unavailable. */
  heading: number | null;
  /** Device speed in km/h. null when unavailable or stationary. */
  speedKmH: number | null;
  /** Network connection status */
  isOffline: boolean;
  /** True while navigating but the device has no fresh GPS fix (location off /
   *  signal lost). Derived from fix staleness, not just the watchPosition error. */
  gpsLost: boolean;
  /** Partner's latest live location (if available in the same space) */
  partnerLocation: PartnerLocation | null;
  /** Partner link health, or null when no partner is being tracked. */
  partnerConnection: PartnerConnection | null;
  /** Accumulated travelled path as [lng, lat] pairs for a map line. */
  /** Estimated remaining distance in metres (null before first fix). */
  remainingMeters: number | null;
  /** Estimated remaining time in seconds (null before first fix). */
  remainingSeconds: number | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Feed the route polyline + totals so the hook can compute remaining distance live. */
  setRouteInfo: (coords: Array<[number, number]>, totalMeters: number, totalSeconds: number, legs?: LegInfo[]) => void;
  legs: LegInfo[];
  /** Send a quick ping emotion to the partner */
  /**
   * Returns why nothing was sent, so the caller can say so. It used to return
   * void and `return` early on both a missing fix and the spam guard, which is
   * how four emotion buttons could be tapped all day with no reaction of any
   * kind — the two most likely outcomes were the two silent ones.
   */
  sendPingAction: (action: string) => Promise<PingResult>;
  /** Epoch ms until which another ping is refused; lets the UI show the wait. */
  pingReadyAt: number;
  /** User's own latest ping action to show their own emotion locally */
  userPingAction: string | null;
};

// ── Geo helpers ──────────────────────────────────────────────────────────────

/** Haversine distance in metres between two points. */
// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * "Follow me" navigation: streams the device location via watchPosition while
 * keeping the screen awake. Tracks heading for map rotation and computes
 * remaining distance/time along the route polyline.
 */
export function useLiveNavigation(options?: {
  onOffRoute?: (userGeo: LatLng) => void;
  offRouteThresholdMeters?: number;
}): LiveNavigation {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isNavigating, setIsNavigating] = useState(false);
  const [userGeo, setUserGeo] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speedKmH, setSpeedKmH] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  // Timestamp of the last successful GPS fix; drives own "lost GPS" detection.
  const [lastFixTs, setLastFixTs] = useState<number>(() => Date.now());
  // Ticks while navigating so partner + GPS staleness re-evaluate between events.
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [remainingMeters, setRemainingMeters] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [legs, setLegs] = useState<LegInfo[]>([]);
  const [userPingAction, setUserPingAction] = useState<string | null>(null);
  const [pingReadyAt, setPingReadyAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation | null>(null);
  // True once a partner has appeared this session, so a partner who later drops
  // out of the server's 5-min window still reads as "disconnected" rather than
  // silently vanishing (which would look like they reconnected).
  const [everHadPartner, setEverHadPartner] = useState(false);

  // Store the latest data in a ref so the interval doesn't get cleared on every GPS update
  const pingPayloadRef = useRef({
    userGeo,
    heading,
    speedKmH,
    accuracyM,
  });

  // Keep the ref up-to-date with every state change
  useEffect(() => {
    pingPayloadRef.current = {
      userGeo,
      heading,
      speedKmH,
      accuracyM,
    };
  }, [userGeo, heading, speedKmH, accuracyM]);
  
  const pingLiveLocation = trpc.location.pingLiveLocation.useMutation();
  const lastPingTime = useRef<number>(0);

  const sendPingAction = useCallback(async (action: string): Promise<PingResult> => {
    const now = Date.now();
    if (now - lastPingTime.current < PING_COOLDOWN_MS) return "too-soon";

    const p = pingPayloadRef.current;
    // A ping rides along with a location update, so without a fix there is
    // nothing to attach it to. Say so rather than doing nothing.
    if (!p.userGeo) return "no-location";

    lastPingTime.current = now;
    setPingReadyAt(now + PING_COOLDOWN_MS);

    // Optimistic: show the user's own emotion the instant they tap, instead of
    // after the network round-trip. The mutation still runs to deliver it to the
    // partner; if it fails the emotion simply isn't propagated (no rollback
    // needed — it's an ephemeral self-affordance).
    setUserPingAction(action);

    let batteryLevel = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.getBattery) {
        const battery = await nav.getBattery();
        batteryLevel = Math.round(battery.level * 100);
      }
    } catch {
      // ignore
    }

    pingLiveLocation.mutate({
      lat: p.userGeo.lat,
      lng: p.userGeo.lng,
      heading: p.heading,
      speedKmH: p.speedKmH,
      accuracy: p.accuracyM,
      batteryLevel,
      pingAction: action,
    }, {
      onSuccess: (partners) => {
        if (partners && partners.length > 0) {
          setPartnerLocation(partners[0]);
          setEverHadPartner(true);
        }
        // Empty result is treated as transient: keep the last-known partner so the
        // HUD/route don't flicker out on a single lapsed poll. The staleness
        // derivation (PARTNER_STALE_MS) downgrades it to "stale" if it stays gone.
      }
    });
    return "sent";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push the current location to the server and pull the partner's back. Shared
  // by the 5s interval and the one-shot "ping as soon as we get a fix" so the
  // partner's HUD/route appears within a second of starting — not up to 5s later.
  const sendLivePing = useCallback(async () => {
    const p = pingPayloadRef.current;
    if (!p.userGeo) return;
    let batteryLevel = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n = navigator as any;
      if (n.getBattery) batteryLevel = Math.round((await n.getBattery()).level * 100);
    } catch {
      /* battery API unavailable — fine */
    }
    pingLiveLocation.mutate(
      {
        lat: p.userGeo.lat,
        lng: p.userGeo.lng,
        heading: p.heading,
        speedKmH: p.speedKmH,
        accuracy: p.accuracyM,
        batteryLevel,
        pingAction: null,
      },
      {
        onSuccess: (partners) => {
          if (partners && partners.length > 0) {
            setPartnerLocation(partners[0]);
            setEverHadPartner(true);
          }
          // Keep the last-known partner on an empty result (see sendPingAction):
          // avoids HUD/route flicker; staleness derivation handles a real drop.
        },
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sendLivePingRef = useRef(sendLivePing);
  sendLivePingRef.current = sendLivePing;

  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockLike | null>(null);

  // Route data set externally so the hook can compute remaining distance.
  const routeCoordsRef = useRef<Array<[number, number]> | null>(null);
  /* Prefix distances for the current route, and where the last fix matched it. */
  const routeCumRef = useRef<number[] | null>(null);
  const matchIdxRef = useRef(0);
  const routeTotalMetersRef = useRef<number>(0);
  const routeTotalSecondsRef = useRef<number>(0);

  /** Call this after fetching a route to feed the hook the polyline + totals. */
  const setRouteInfo = useCallback(
    (coords: Array<[number, number]>, totalMeters: number, totalSeconds: number, routeLegs?: LegInfo[]) => {
      routeCoordsRef.current = coords;
      // Rebuilt here, not per fix. The match position resets with it: a new
      // line means the old index points nowhere in particular, and a reroute is
      // exactly when a stale hint would send the window looking the wrong way.
      routeCumRef.current = coords.length > 1 ? cumulativeMetres(coords) : null;
      matchIdxRef.current = 0;
      routeTotalMetersRef.current = totalMeters;
      routeTotalSecondsRef.current = totalSeconds;
      if (routeLegs) setLegs(routeLegs);
    },
    [],
  );

  // Expose setRouteInfo on the returned object so the page can call it.
  // We store it on a ref so `start` doesn't depend on it for the useCallback deps.
  const setRouteInfoRef = useRef(setRouteInfo);
  setRouteInfoRef.current = setRouteInfo;

  const acquireWakeLock = useCallback(() => {
    const nav = navigator as NavigatorWithWakeLock;
    nav.wakeLock
      ?.request("screen")
      .then((s) => {
        wakeLock.current = s;
      })
      .catch(() => {
        /* wake lock is best-effort; ignore if unsupported/denied */
      });
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    setIsNavigating(false);
    setHeading(null);
    setRemainingMeters(null);
    setRemainingSeconds(null);
  }, []);

  const start = useCallback(() => {
    if (watchId.current != null) return; // already navigating — avoid a 2nd watch
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setError(null);
    setRemainingMeters(null);
    setRemainingSeconds(null);
    setEverHadPartner(false);
    setLastFixTs(Date.now()); // count "lost GPS" from when tracking begins
    setIsNavigating(true);
    acquireWakeLock();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const g = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(g);
        setLastFixTs(Date.now()); // fresh fix → clears any "lost GPS" state
        setError(null);
  
        // Heading: only set when the device reports a valid value.
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }

        // Speed: convert from m/s to km/h
        if (pos.coords.speed != null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0) {
          setSpeedKmH(Math.round(pos.coords.speed * 3.6));
        } else {
          setSpeedKmH(null);
        }

        // GPS horizontal accuracy in metres (used to flag a weak fix).
        setAccuracyM(
          pos.coords.accuracy != null && !isNaN(pos.coords.accuracy)
            ? Math.round(pos.coords.accuracy)
            : null,
        );

        // Remaining distance along route.
        const rc = routeCoordsRef.current;
        if (rc && rc.length >= 2) {
          const cum = routeCumRef.current ?? cumulativeMetres(rc);
          if (!routeCumRef.current) routeCumRef.current = cum;
          const { remaining, deviation, idx } = remainingAlongRoute(g, rc, cum, matchIdxRef.current);
          matchIdxRef.current = idx;
          setRemainingMeters(Math.round(remaining));

          if (optionsRef.current?.onOffRoute && deviation > (optionsRef.current.offRouteThresholdMeters ?? 50)) {
            optionsRef.current.onOffRoute(g);
          }

          // Estimate remaining time proportionally.
          const totalM = routeTotalMetersRef.current;
          const totalS = routeTotalSecondsRef.current;
          if (totalM > 0) {
            setRemainingSeconds(Math.round((remaining / totalM) * totalS));
          }
        }
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Bị chặn quyền vị trí — cho phép rồi thử lại."
            : "Không lấy được vị trí khi đang đi.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, [acquireWakeLock]);

  // Browsers drop the wake lock when the tab is hidden; re-acquire on return.
  useEffect(() => {
    const onVisible = () => {
      if (
        isNavigating &&
        document.visibilityState === "visible" &&
        !wakeLock.current
      ) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isNavigating, acquireWakeLock]);

  // Always clean up the watch + wake lock when the page unmounts.
  useEffect(() => () => stop(), [stop]);

  // Ping interval: every 5 seconds, send userGeo to server and fetch partner's
  // position. Fires once immediately too so we don't wait a full cycle.
  useEffect(() => {
    if (!isNavigating || isOffline) return;
    sendLivePingRef.current();
    // 2.5s cadence: partner HUD/route stay within ~2.5s of reality (was 5s).
    // The extra writes are cheap for a 2-person space and the responsiveness
    // gain on a live shared trip is the whole point of the feature.
    const interval = setInterval(() => sendLivePingRef.current(), 2500);
    return () => clearInterval(interval);
    // ONLY depend on isNavigating & isOffline.
    // Do NOT depend on userGeo or pingLiveLocation to prevent infinite reset loops!
   
  }, [isNavigating, isOffline]);

  // Ping the moment the first GPS fix lands, so the partner discovers us (and we
  // them) right away instead of after the first 5s interval — this is what makes
  // both riders' HUD/route render promptly regardless of how far apart they are.
  const didInitialPingRef = useRef(false);
  useEffect(() => {
    if (!isNavigating) {
      didInitialPingRef.current = false;
      return;
    }
    if (didInitialPingRef.current || !userGeo) return;
    didInitialPingRef.current = true;
    sendLivePingRef.current();
   
  }, [isNavigating, userGeo]);

  // Re-evaluate partner staleness on a steady tick while navigating (the ping
  // poll alone would leave `nowTs` frozen between fetches).
  useEffect(() => {
    if (!isNavigating) return;
    const t = setInterval(() => setNowTs(Date.now()), STALE_TICK_MS);
    return () => clearInterval(t);
  }, [isNavigating]);

  // Track network connection status
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Own GPS considered lost while navigating if no fix landed recently, or the
  // watch reported an error. Staleness catches "location turned off" where the
  // browser silently stops delivering positions without firing the error cb.
  const gpsLost = isNavigating && (error != null || nowTs - lastFixTs > GPS_STALE_MS);

  // Derive partner link health from ping freshness + accuracy. A partner who
  // dropped out entirely (null) but was seen earlier still reads as "stale".
  const partnerConnection: PartnerConnection | null = !partnerLocation
    ? everHadPartner
      ? "stale"
      : null
    : nowTs - new Date(partnerLocation.updatedAt).getTime() > PARTNER_STALE_MS
      ? "stale"
      : partnerLocation.accuracy != null && partnerLocation.accuracy > WEAK_ACCURACY_M
        ? "weak"
        : "online";

  return {
    isNavigating,
    userGeo,
    heading,
    speedKmH,
    isOffline,
    gpsLost,
    partnerLocation,
    accuracyM,
    partnerConnection,
    userPingAction,
    remainingMeters,
    remainingSeconds,
    error,
    start,
    stop,
    setRouteInfo,
    sendPingAction,
    pingReadyAt,
    legs,
  };
}
