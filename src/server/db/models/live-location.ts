import { Schema, model, models, type InferSchemaType } from "mongoose";

const liveLocationSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    userId: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    heading: { type: Number, default: null },
    speedKmH: { type: Number, default: null },
    // GPS horizontal accuracy in metres (lower = better). Used to flag "weak GPS".
    accuracy: { type: Number, default: null },
    batteryLevel: { type: Number, default: null },
    // The last emotion sent, and when. A position write never clears either:
    // the 2.5 s position loop used to write `pingAction: null` over a ping
    // before the stream's one-second poll had seen it, and the ping was lost.
    pingAction: { type: String, default: null },
    pingAt: { type: Date, default: null },
    // What this phone says is left on its own route, while it is navigating —
    // so the partner shows a live number rather than the one from departure.
    remainingMeters: { type: Number, default: null },
    remainingSeconds: { type: Number, default: null },
    // Auto-delete records after 1 hour (3600 seconds) of inactivity
    updatedAt: { type: Date, default: Date.now, expires: 3600 },
  },
  { timestamps: true }
);

// One active session per user per space
liveLocationSchema.index({ spaceId: 1, userId: 1 }, { unique: true });
// Covers SSE partner-ping query: { spaceId, userId: {$ne:...}, updatedAt: {$gt:...} }
liveLocationSchema.index({ spaceId: 1, updatedAt: 1 });

export type LiveLocation = InferSchemaType<typeof liveLocationSchema>;

export const LiveLocationModel =
  models.LiveLocation ?? model("LiveLocation", liveLocationSchema);
