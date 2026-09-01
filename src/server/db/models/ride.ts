import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A motorbike ride recorded when the couple's live navigation ends.
 *
 * This is the keepsake record, not the live-navigation session itself — that
 * state lives in `LiveLocationModel` and the client's navigation hook, and is
 * torn down the moment a trip ends. A ride is what survives afterwards: where
 * the rider went, how far, how long, and whether the other person came along.
 */
const rideSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    userId: { type: String, required: true }, // who rode
    destinationName: { type: String, required: true },
    // Set only when the destination was a saved place; a free-typed or
    // map-picked destination has no Location document to point back at.
    destinationLocationId: { type: String },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    distanceMeters: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, required: true, min: 0 },
    // [lng, lat] pairs, the same coordinate order the routing engine and the
    // live-navigation hook already use everywhere else in this app. May be
    // empty — a ride can still be recorded from its summary numbers alone
    // even if the breadcrumb trail was lost (app killed mid-ride, no GPS
    // fix for a whole leg).
    path: { type: [[Number]], default: [] },
    // Whether the partner rode along on an accepted companion trip — not
    // "whether anyone else exists", since a space only ever has two members.
    companion: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Serves ride.list (newest ride first, keyset-paginated on endedAt) and
// ride.stats (space-wide totals) — both filter by spaceId alone or with an
// endedAt range on this same prefix.
rideSchema.index({ spaceId: 1, endedAt: -1 });

export type Ride = InferSchemaType<typeof rideSchema>;

export const RideModel = models.Ride ?? model("Ride", rideSchema);
