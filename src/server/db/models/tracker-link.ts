import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A member's background tracker (OwnTracks) linked to a space.
 *
 * The document's id is the tracker's username; its password is derived from
 * that id and a server secret (src/server/lib/tracker-token.ts), so nothing
 * secret is stored here and the one-tap setup link can be shown again later
 * without changing it. Unlinking deletes the row, which is what revokes it.
 *
 * The rest is what the tracker last told us, kept so the setup screen can say
 * what is wrong — "nothing has arrived", "only allowed while in use",
 * "Android may stop it to save battery" — instead of leaving someone to guess.
 */
const trackerLinkSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    userId: { type: String, required: true },
    /** When the last message of any kind arrived. */
    lastSeenAt: { type: Date, default: null },
    /** When the newest position was taken (the device's clock, not ours). */
    lastFixAt: { type: Date, default: null },
    monitoring: { type: Number, default: null },
    battery: { type: Number, default: null },
    statusAskedAt: { type: Date, default: null },
    health: {
      type: new Schema(
        {
          platform: { type: String, enum: ["ios", "android"] },
          location: { type: String, enum: ["ok", "foreground", "denied", "unknown"] },
          batteryOptimized: { type: Boolean, default: null },
          powerSave: { type: Boolean, default: null },
          hibernation: { type: Boolean, default: null },
          backgroundRefreshOff: { type: Boolean, default: null },
          at: { type: Date },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

// One tracker per member per space; the setup screen and the cascade both
// look rows up by these two.
trackerLinkSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

export type TrackerLink = InferSchemaType<typeof trackerLinkSchema>;

export const TrackerLinkModel = models.TrackerLink ?? model("TrackerLink", trackerLinkSchema);
