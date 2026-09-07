"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Geo = { lat: number; lng: number };

export type RerouteStatus = "idle" | "fetching" | "waiting-network" | "retrying";

export type RerouteManager = {
  status: RerouteStatus;
  /** A detour has been noticed and the new line is not on the map yet. */
  pending: boolean;
  /** Called by the GPS watch every time the rider is off the drawn line. */
  request: (geo: Geo) => void;
  /** Forget everything — the ride ended. */
  reset: () => void;
  /** True while a route request is out; readable from effects without a render. */
  busyRef: React.MutableRefObject<boolean>;
};

/*
 * Re-routing that survives the network going away.
 *
 * The first version was one fetch, fired when the rider left the line, with a
 * five-second guard against firing twice. Three things went wrong with it on a
 * real ride, all of them while the phone changed from Wi-Fi to 4G or lost
 * signal under a bridge:
 *
 *  - The fetch had no deadline. A request caught mid-switch neither fails nor
 *    completes; it hangs, and while it hung the guard stayed set, so the ride
 *    never re-routed again.
 *  - React Query pauses a fetch made while `navigator.onLine` is false and
 *    replays it when the network returns — with the ORIGIN captured when the
 *    detour was noticed. By then the rider was somewhere else, so the new line
 *    started from a point they had left minutes ago.
 *  - Nothing remembered that a re-route was owed. If the request failed, the
 *    rider had to still be off-route at the next GPS fix for anything to happen.
 *
 * So: every request has a deadline; the origin is read at the moment the
 * request is actually sent; a failed or offline request stays *pending* and is
 * retried — with backoff while the network is merely flaky, and the moment the
 * `online` event fires when it was gone.
 */
const TIMEOUT_MS = 12_000;
/** After a success, ignore off-route reports briefly: the new line is being matched. */
const COOLDOWN_MS = 5_000;
const RETRY_BASE_MS = 1_500;
const RETRY_MAX_MS = 15_000;
/** The radio reports "online" a moment before packets actually flow. */
const ONLINE_SETTLE_MS = 800;

export function useRerouteManager(opts: {
  isOffline: boolean;
  /** Only while a ride is on; off, everything is dropped. */
  active: boolean;
  /** Fetch and apply the new route. Must reject on failure so the retry runs. */
  perform: (origin: Geo, signal: AbortSignal) => Promise<void>;
  /** The freshest fix — read when the request goes out, not when it was asked for. */
  currentGeo: () => Geo | null;
}): RerouteManager {
  const performRef = useRef(opts.perform);
  performRef.current = opts.perform;
  const geoRef = useRef(opts.currentGeo);
  geoRef.current = opts.currentGeo;
  const offlineRef = useRef(opts.isOffline);
  offlineRef.current = opts.isOffline;

  const [status, setStatus] = useState<RerouteStatus>("idle");
  const [pending, setPending] = useState(false);
  const busyRef = useRef(false);
  const s = useRef({
    pending: false,
    inFlight: false,
    attempt: 0,
    cooldownUntil: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    lastGeo: null as Geo | null,
  });

  const clearTimer = () => {
    if (s.current.timer) clearTimeout(s.current.timer);
    s.current.timer = null;
  };

  const tick = useCallback(async () => {
    const st = s.current;
    if (!st.pending || st.inFlight || st.timer) return;
    const wait = st.cooldownUntil - Date.now();
    if (wait > 0) {
      // Come back when the cooldown ends, rather than relying on another fix.
      st.timer = setTimeout(() => {
        st.timer = null;
        void tick();
      }, wait);
      return;
    }
    if (offlineRef.current) {
      setStatus("waiting-network");
      return;
    }
    const origin = geoRef.current() ?? st.lastGeo;
    if (!origin) return;

    st.inFlight = true;
    busyRef.current = true;
    setStatus("fetching");
    const ctrl = new AbortController();
    const deadline = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      await performRef.current(origin, ctrl.signal);
      st.pending = false;
      st.attempt = 0;
      st.cooldownUntil = Date.now() + COOLDOWN_MS;
      setPending(false);
      setStatus("idle");
    } catch {
      st.attempt += 1;
      const offline = offlineRef.current || (typeof navigator !== "undefined" && !navigator.onLine);
      if (offline) {
        // Not a retry case: the `online` event is what wakes this up.
        setStatus("waiting-network");
      } else {
        setStatus("retrying");
        const delay = Math.min(RETRY_BASE_MS * 2 ** (st.attempt - 1), RETRY_MAX_MS);
        st.timer = setTimeout(() => {
          st.timer = null;
          void tick();
        }, delay);
      }
    } finally {
      clearTimeout(deadline);
      st.inFlight = false;
      busyRef.current = false;
    }
  }, []);

  const request = useCallback(
    (geo: Geo) => {
      const st = s.current;
      st.lastGeo = geo;
      if (!st.pending) {
        st.pending = true;
        setPending(true);
      }
      void tick();
    },
    [tick],
  );

  const reset = useCallback(() => {
    clearTimer();
    s.current.pending = false;
    s.current.attempt = 0;
    s.current.cooldownUntil = 0;
    s.current.lastGeo = null;
    setPending(false);
    setStatus("idle");
  }, []);

  // The network came back: whatever was owed is sent now, from where we are now.
  useEffect(() => {
    if (opts.isOffline) return;
    const st = s.current;
    if (!st.pending) return;
    clearTimer();
    st.attempt = 0;
    st.timer = setTimeout(() => {
      st.timer = null;
      void tick();
    }, ONLINE_SETTLE_MS);
    return clearTimer;
  }, [opts.isOffline, tick]);

  // The OS-level event as well, in case the hook above is fed a lagging flag.
  useEffect(() => {
    const onOnline = () => {
      const st = s.current;
      if (!st.pending || st.inFlight) return;
      clearTimer();
      st.attempt = 0;
      st.timer = setTimeout(() => {
        st.timer = null;
        void tick();
      }, ONLINE_SETTLE_MS);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [tick]);

  useEffect(() => {
    if (!opts.active) reset();
  }, [opts.active, reset]);

  useEffect(() => clearTimer, []);

  return { status, pending, request, reset, busyRef };
}
