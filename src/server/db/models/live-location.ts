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
    pingAction: { type: String, default: null },
    // Auto-delete records after 1 hour (3600 seconds) of inactivity
    updatedAt: { type: Date, default: Date.now, expires: 3600 },
  },
  { timestamps: true }
);

// One active session per user per space
liveLocationSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

export type LiveLocation = InferSchemaType<typeof liveLocationSchema>;

export const LiveLocationModel =
  models.LiveLocation ?? model("LiveLocation", liveLocationSchema);
