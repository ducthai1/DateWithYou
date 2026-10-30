import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Every fix the background tracker sent, with the phone's own time.
 *
 * Raw material only: finished trips become Rides (src/server/lib/tracker-trips.ts)
 * and their pace becomes SpeedCell rows, so the points themselves expire after
 * a month — a precise location history kept forever is a liability nobody
 * asked for.
 */
const trackPointSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    userId: { type: String, required: true },
    at: { type: Date, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
  },
  { versionKey: false },
);

// A fix re-sent after a failed reply lands once.
trackPointSchema.index({ spaceId: 1, userId: 1, at: 1 }, { unique: true });
trackPointSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export type TrackPoint = InferSchemaType<typeof trackPointSchema>;

export const TrackPointModel = models.TrackPoint ?? model("TrackPoint", trackPointSchema);
