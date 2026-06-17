import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/maps";
import { trpc } from "@/lib/trpc";

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

/** Minimal screen Wake Lock shape (avoids relying on lib.dom typings). */
type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

export type LegInfo = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> };
};

export type LiveNavigation = {
  isNavigating: boolean;
  /** Latest live position (null until the first fix). */
  userGeo: LatLng | null;
  /** Device heading in degrees (0 = north, 90 = east). null when unavailable. */
  heading: number | null;
  /** Device speed in km/h. null when unavailable or stationary. */
  speedKmH: number | null;
  /** Network connection status */
  isOffline: boolean;
  /** Partner's latest live location (if available in the same space) */
  partnerLocation: PartnerLocation | null;
  /** Partner link health, or null when no partner is being tracked. */
  partnerConnection: PartnerConnection | null;
  /** Accumulated travelled path as [lng, lat] pairs for a map line. */
  traveled: Array<[number, number]>;
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
  sendPingAction: (action: string) => void;
  /** User's own latest ping action to show their own emotion locally */
  userPingAction: string | null;
};

// ── Geo helpers ──────────────────────────────────────────────────────────────

/** Haversine distance in metres between two points. */
function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Distance from point P to segment AB on an equirectangular approximation.
 */
function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): { distance: number, projection: LatLng } {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * cosLat; const py = p.lat;
  const ax = a.lng * cosLat; const ay = a.lat;
  const bx = b.lng * cosLat; const by = b.lat;
  
  const l2 = (bx - ax)**2 + (by - ay)**2;
  if (l2 === 0) return { distance: haversineM(p, a), projection: a };
  
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const proj = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return { distance: haversineM(p, proj), projection: proj };
}

/**
 * Given the user's current position and the full route polyline ([lng,lat]),
 * find the closest segment on the route, compute cross-track deviation,
 * and sum the remaining segment lengths.
 */
function remainingAlongRoute(
  user: LatLng,
  coords: Array<[number, number]>,
): { remaining: number; deviation: number } {
  if (coords.length < 2) return { remaining: 0, deviation: 0 };
  let bestIdx = 0;
  let bestDist = Infinity;
  let bestProj = { lat: coords[0][1], lng: coords[0][0] };

  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][1], lng: coords[i][0] };
    const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const { distance, projection } = distanceToSegment(user, a, b);
    if (distance < bestDist) {
      bestDist = distance;
      bestIdx = i;
      bestProj = projection;
    }
  }

  // Sum from the snapped projection point to the end of the route.
  let total = haversineM(bestProj, { lat: coords[bestIdx + 1][1], lng: coords[bestIdx + 1][0] });
  for (let i = bestIdx + 1; i < coords.length - 1; i++) {
    total += haversineM(
      { lat: coords[i][1], lng: coords[i][0] },
      { lat: coords[i + 1][1], lng: coords[i + 1][0] },
    );
  }
  return { remaining: total, deviation: bestDist };
}

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
  // Ticks while navigating so partner staleness is re-evaluated between pings.
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [traveled, setTraveled] = useState<Array<[number, number]>>([]);
  const [remainingMeters, setRemainingMeters] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [legs, setLegs] = useState<LegInfo[]>([]);
  const [userPingAction, setUserPingAction] = useState<string | null>(null);
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

  const sendPingAction = useCallback(async (action: string) => {
    const now = Date.now();
    // Chặn bấm spam (chờ ít nhất 2.5 giây)
    if (now - lastPingTime.current < 2500) return;
    
    const p = pingPayloadRef.current;
    if (!p.userGeo) return;

    lastPingTime.current = now;

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
        setUserPingAction(action);
        if (partners && partners.length > 0) {
          setPartnerLocation(partners[0]);
          setEverHadPartner(true);
        } else {
          setPartnerLocation(null);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockLike | null>(null);

  // Route data set externally so the hook can compute remaining distance.
  const routeCoordsRef = useRef<Array<[number, number]> | null>(null);
  const routeTotalMetersRef = useRef<number>(0);
  const routeTotalSecondsRef = useRef<number>(0);

  /** Call this after fetching a route to feed the hook the polyline + totals. */
  const setRouteInfo = useCallback(
    (coords: Array<[number, number]>, totalMeters: number, totalSeconds: number, routeLegs?: LegInfo[]) => {
      routeCoordsRef.current = coords;
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
    setTraveled([]);
    setRemainingMeters(null);
    setRemainingSeconds(null);
    setEverHadPartner(false);
    setIsNavigating(true);
    acquireWakeLock();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const g = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(g);
        setTraveled((t) => [...t, [g.lng, g.lat]]);

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
          const { remaining, deviation } = remainingAlongRoute(g, rc);
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

  // Ping interval: every 5 seconds, send userGeo to server and fetch partner's position
  useEffect(() => {
    if (!isNavigating || isOffline) return;
    
    const interval = setInterval(async () => {
      const p = pingPayloadRef.current;
      if (!p.userGeo) return; // Wait until we have a location to ping

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
        pingAction: null, // Regular interval clears the action so it doesn't get stuck
      }, {
        onSuccess: (partners) => {
          if (partners && partners.length > 0) {
            setPartnerLocation(partners[0]);
            setEverHadPartner(true);
          } else {
            setPartnerLocation(null);
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
    // ONLY depend on isNavigating & isOffline. 
    // Do NOT depend on userGeo or pingLiveLocation to prevent infinite reset loops!
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, isOffline]);

  // Re-evaluate partner staleness on a steady tick while navigating (the ping
  // poll alone would leave `nowTs` frozen between fetches).
  useEffect(() => {
    if (!isNavigating) return;
    const t = setInterval(() => setNowTs(Date.now()), 3000);
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
    partnerLocation,
    partnerConnection,
    userPingAction,
    traveled,
    remainingMeters,
    remainingSeconds,
    error,
    start,
    stop,
    setRouteInfo,
    sendPingAction,
    legs,
  };
}
