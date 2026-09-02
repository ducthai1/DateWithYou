/*
 * Getting this device a push subscription, in one place.
 *
 * Both the silent re-registration on load and the switch in settings need the
 * same sequence, and they had their own copies of it — including their own copy
 * of the key conversion, which is the sort of duplication that lets two paths
 * drift into disagreeing about whether a device is registered.
 */

/**
 * Web Push needs the VAPID public key as raw bytes, not base64url text.
 *
 * Returns the ArrayBuffer rather than the view: `applicationServerKey` is typed
 * as BufferSource, and a Uint8Array over a generic ArrayBufferLike does not
 * satisfy it under the current lib types.
 */
export function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normalised = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buffer;
}

function sameBytes(a: ArrayBuffer | null | undefined, b: ArrayBuffer): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

export type PushRegistration = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * The subscription for this device, creating one if there is none.
 *
 * A subscription is bound to the VAPID key it was created with, permanently. So
 * one minted under a previous key is not merely stale — the push service
 * rejects every send to it with a 403 that nothing here prunes, which produces
 * the worst possible symptom: a switch that says notifications are on, and
 * notifications that never arrive. Reusing whatever `getSubscription()` returns
 * is therefore only safe after checking it was made with the key in use now.
 *
 * Throws if the browser refuses. Callers decide whether that is worth saying.
 */
export async function ensurePushSubscription(key: string): Promise<PushRegistration> {
  const wanted = urlBase64ToBytes(key);
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameBytes(sub.options?.applicationServerKey, wanted)) {
    // Minted under a different key: unusable, and no amount of retrying helps.
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({
    // Required by every browser: a push that shows nothing is not allowed.
    userVisibleOnly: true,
    applicationServerKey: wanted,
  });

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Trình duyệt trả về thuê bao thiếu khoá");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

/** Why this device cannot receive notifications, or null when it can. */
export type PushBlocker =
  | "no-service-worker"
  | "ios-needs-install"
  | "unsupported"
  | "denied"
  | null;

/** True when the page is running as an installed app rather than in a tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS predates display-mode and still reports through this instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * What stands in the way, named — because "nothing here" is the one answer a
 * person cannot act on.
 *
 * The switch used to render null whenever push was unavailable, which meant the
 * single case that needs an instruction the most — an iPhone in a Safari tab,
 * where Apple grants push only to an installed app — was the case where the
 * instruction disappeared. Someone looking for why invites never arrive found
 * an empty space where the explanation should be.
 */
export function pushBlocker(): PushBlocker {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator)) return "no-service-worker";
  if (!("Notification" in window) || !("PushManager" in window)) {
    return isIosLike() && !isStandalone() ? "ios-needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return null;
}
