import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/maps";
import { trpc } from "@/lib/trpc";

export type PartnerLocation = {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: Date;
};

/** Minimal screen Wake Lock shape (avoids relying on lib.dom typings). */
type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
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
  setRouteInfo: (coords: Array<[number, number]>, totalMeters: number, totalSeconds: number) => void;
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
  const [traveled, setTraveled] = useState<Array<[number, number]>>([]);
  const [remainingMeters, setRemainingMeters] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation | null>(null);
  
  const pingLiveLocation = trpc.location.pingLiveLocation.useMutation();
  
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockLike | null>(null);

  // Route data set externally so the hook can compute remaining distance.
  const routeCoordsRef = useRef<Array<[number, number]> | null>(null);
  const routeTotalMetersRef = useRef<number>(0);
  const routeTotalSecondsRef = useRef<number>(0);

  /** Call this after fetching a route to feed the hook the polyline + totals. */
  const setRouteInfo = useCallback(
    (coords: Array<[number, number]>, totalMeters: number, totalSeconds: number) => {
      routeCoordsRef.current = coords;
      routeTotalMetersRef.current = totalMeters;
      routeTotalSecondsRef.current = totalSeconds;
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
    if (!isNavigating || !userGeo || isOffline) return;
    
    // Immediate ping when we get a fresh userGeo, but we want to throttle it
    // Using a simple interval is easier.
    const interval = setInterval(() => {
      pingLiveLocation.mutate({
        lat: userGeo.lat,
        lng: userGeo.lng,
        heading: heading,
      }, {
        onSuccess: (partners) => {
          if (partners && partners.length > 0) {
            setPartnerLocation(partners[0]);
          } else {
            setPartnerLocation(null);
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isNavigating, userGeo, heading, isOffline, pingLiveLocation]);

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

  return {
    isNavigating,
    userGeo,
    heading,
    speedKmH,
    isOffline,
    partnerLocation,
    traveled,
    remainingMeters,
    remainingSeconds,
    error,
    start,
    stop,
    setRouteInfo,
  };
}
