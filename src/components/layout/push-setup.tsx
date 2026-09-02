"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ensurePushSubscription, pushBlocker } from "@/lib/push-subscribe";

/**
 * Keeps this device's push subscription registered — silently, and only when
 * permission has already been given.
 *
 * It never asks. A permission prompt fired on page load is the pattern browsers
 * added their own friction to precisely because it is answered "no" by reflex;
 * asking belongs to a moment where the person can see what they would get, which
 * is the switch in settings. What this does is the other half: once permission
 * exists, the endpoint has to be re-registered on visits, because a browser may
 * rotate it and the server has no way to learn that except by being told.
 */
export function PushSetup() {
  const subscribe = trpc.push.subscribe.useMutation();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return;
    if (pushBlocker() !== null) return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;
    const run = async () => {
      try {
        const reg = await ensurePushSubscription(key);
        if (cancelled) return;
        subscribe.mutate({
          endpoint: reg.endpoint,
          keys: reg.keys,
          userAgent: navigator.userAgent.slice(0, 300),
        });
      } catch (err) {
        // A refusal here costs notifications, nothing else.
        console.warn("push: could not register", err);
      }
    };
    // After load: this competes with nothing the person is waiting for.
    if (document.readyState === "complete") void run();
    else window.addEventListener("load", () => void run(), { once: true });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
