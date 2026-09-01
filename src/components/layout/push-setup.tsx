"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Web Push needs the VAPID public key as raw bytes, not base64url text.
 *
 * Returns the ArrayBuffer rather than the view: `applicationServerKey` is typed
 * as BufferSource, and a Uint8Array over a generic ArrayBufferLike does not
 * satisfy it under the current lib types.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normalised = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buffer;
}

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
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;
    const run = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            // Required by every browser: a push that shows nothing is not allowed.
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToBytes(key),
          }));
        if (cancelled) return;
        const json = sub.toJSON() as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
        subscribe.mutate({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
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
