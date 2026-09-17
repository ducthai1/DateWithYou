"use client";

import { useEffect, useRef } from "react";

/**
 * Draw the route the moment the phone can say where it is.
 *
 * "Chỉ đường" pressed before location was on set an error and stopped there.
 * Nothing was owed, so nothing ever replayed it: turning location on later,
 * reloading, pausing and resuming — none of them redrew the line, because none
 * of them re-ran the request. The only way out was to press the button again,
 * which is not something a rider should have to work out mid-junction.
 *
 * The page already owed a request when the NETWORK was the blocker and replayed
 * it on the way back online. This is the same idea for the other blocker.
 *
 * Why polling rather than `watchPosition`: a watch started while permission is
 * denied behaves differently in every engine — some call the error callback
 * once and go quiet, some repeat it, and none of them report the case that
 * matters most here, where permission is already granted and the OS simply has
 * Location Services switched off. A cheap poll answers all of them the same
 * way, and it only runs while something is actually owed.
 *
 * The event listeners are what make it feel instant rather than "within a few
 * seconds": coming back from the Settings app fires `visibilitychange`, and
 * flipping the site permission fires `change` on the Permissions API where it
 * exists. The poll is the floor under both.
 */
export function usePositionRecovery({
  waiting,
  onPosition,
}: {
  /** True while a request is owed and blocked on not having a position. */
  waiting: boolean;
  /** Called once, with the first fix that arrives. */
  onPosition: (geo: { lat: number; lng: number }) => void;
}): void {
  const cb = useRef(onPosition);
  cb.current = onPosition;

  useEffect(() => {
    if (!waiting || typeof navigator === "undefined" || !navigator.geolocation) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const succeed = (pos: GeolocationPosition) => {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
      cb.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const tryOnce = () => {
      if (stopped) return;
      attempts += 1;
      navigator.geolocation.getCurrentPosition(succeed, schedule, {
        enableHighAccuracy: false,
        timeout: 10_000,
        // Never a cached fix here. The whole point is to notice that the
        // device STARTED producing positions; a stored one from before proves
        // nothing and would replay the request with a point already left.
        maximumAge: 0,
      });
    };

    /*
     * Slow down, but never stop.
     *
     * Two seconds for the first half-minute, which covers somebody flipping the
     * switch while looking at the screen, then fifteen — enough to catch a
     * rider who wandered off to the Settings app without keeping a request in
     * flight the whole time.
     */
    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(tryOnce, attempts < 15 ? 2_000 : 15_000);
    };

    const nudge = () => {
      if (stopped || document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      tryOnce();
    };

    tryOnce();
    document.addEventListener("visibilitychange", nudge);

    // Permissions API is absent on older Safari; the poll covers those.
    let perm: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (stopped) return;
        perm = status;
        status.addEventListener("change", nudge);
      })
      .catch(() => {
        /* Not available — the poll is the answer. */
      });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", nudge);
      perm?.removeEventListener("change", nudge);
    };
  }, [waiting]);
}
