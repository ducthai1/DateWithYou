import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A device that has agreed to receive notifications.
 *
 * One row per device, not per person: someone with a phone and a laptop has two
 * endpoints and expects both to buzz. The endpoint URL is the identity — the
 * browser mints it, and re-subscribing on the same device returns the same one,
 * so an upsert on it keeps the table from growing with every visit.
 *
 * Rows die on their own. A push to a revoked or expired endpoint answers 404 or
 * 410, and the sender deletes it then; there is no other way to learn that a
 * browser has forgotten a subscription.
 */
const pushSubscriptionSchema = new Schema(
  {
    userId: { type: String, required: true },
    // Kept so a space can be notified without first resolving its members.
    spaceId: { type: String, required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // Purely diagnostic: which browser a dead endpoint belonged to.
    userAgent: { type: String },
  },
  { timestamps: true },
);

// The endpoint is the device. Unique so re-subscribing updates rather than
// duplicates, and so one device can never be pushed to twice for one event.
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ userId: 1 });

export type PushSubscriptionDoc = InferSchemaType<typeof pushSubscriptionSchema>;

export const PushSubscriptionModel =
  models.PushSubscription ?? model("PushSubscription", pushSubscriptionSchema);
