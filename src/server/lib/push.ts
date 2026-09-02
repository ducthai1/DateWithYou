import webpush from "web-push";
import { connectToDatabase } from "@/server/db/connect";
import { PushSubscriptionModel } from "@/server/db/models/push-subscription";

/**
 * Web Push delivery.
 *
 * This is the only mechanism that reaches a phone which is locked, or in another
 * app, or has the browser closed entirely — everything else this app does to get
 * attention (vibration, a tone, a banner) needs the page to be open and running.
 * It is also the only guaranteed way to make an iPhone buzz, since WebKit ships
 * no Vibration API: a notification is delivered by the operating system, which
 * applies the user's own ringer and haptic settings.
 *
 * On iOS this requires the app to have been added to the Home Screen. Safari
 * grants push to installed web apps only (16.4+), and there is no way around
 * that from the page.
 *
 * Sending is best-effort by design. A failed push must never fail the action
 * that triggered it: an invite that was created and stored is still an invite,
 * whether or not the other phone was reachable.
 */

let configured: boolean | null = null;

/** True when both keys are present, so callers can skip the work entirely. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    // A contact for the push service to reach if this sender misbehaves. It has
    // to be a mailto: or https: URL; the address itself is never shown to users.
    process.env.VAPID_SUBJECT ?? "mailto:hello@vivu-noplan.app",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where to go when it is tapped. */
  url?: string;
  /** Collapses older notifications of the same kind instead of stacking them. */
  tag?: string;
};

/**
 * Notify every device belonging to one person.
 *
 * Endpoints that answer 404 or 410 are deleted as they are found — that is the
 * push protocol's way of saying the subscription is gone for good, and keeping
 * it would mean a failed request on every future send.
 */
/**
 * What a send actually did.
 *
 * It used to return a bare count, and the two ways of returning zero — no keys
 * on the server, no registered device for that person — are the two different
 * problems anyone debugging "the notification never came" needs to tell apart.
 * Reported as a reason rather than inferred from a number.
 */
export type PushResult = {
  reason: "sent" | "not-configured" | "no-devices";
  /** Rows on file for this person. */
  devices: number;
  /** How many the push service accepted. */
  delivered: number;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  if (!pushConfigured()) {
    console.warn("push: VAPID keys missing, nothing sent");
    return { reason: "not-configured", devices: 0, delivered: 0 };
  }
  await connectToDatabase();
  const subs = await PushSubscriptionModel.find({ userId }).lean<
    Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>
  >();
  if (!subs.length) {
    console.warn("push: no registered device for user", userId);
    return { reason: "no-devices", devices: 0, delivered: 0 };
  }

  const body = JSON.stringify(payload);
  let delivered = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body,
          // Long enough to survive a phone that is asleep, short enough that a
          // stale invite is not delivered hours later.
          { TTL: 600, urgency: "high" },
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The endpoint is gone for good; the row can only fail from here.
          dead.push(sub.endpoint);
        } else if (status === 403) {
          /*
           * Signed with a key this endpoint was not created under. The row is
           * dead too, permanently — but it is dropped with a distinct message
           * because the cause is ours, not the browser's: the VAPID pair
           * changed after the device subscribed. The client re-subscribes when
           * it notices the same mismatch; dropping the row here stops us
           * retrying a send that can never succeed in the meantime.
           */
          console.error("push: VAPID key mismatch for endpoint, dropping", sub.endpoint.slice(0, 60));
          dead.push(sub.endpoint);
        } else {
          console.error("push: send failed", status, err);
        }
      }
    }),
  );

  if (dead.length) {
    await PushSubscriptionModel.deleteMany({ endpoint: { $in: dead } }).catch(() => {});
  }

  return { reason: "sent", devices: subs.length, delivered };
}
