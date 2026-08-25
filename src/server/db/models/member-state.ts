import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Per-member, per-space read state for the derived activity feed.
 *
 * The feed itself is derived from the content collections (no activity-log
 * writes), so "unread" cannot live on the items — it lives here as a single
 * watermark per member. Anything the partner created after
 * `lastSeenActivityAt` counts as unread; the member's own actions never do.
 *
 * Absent row = never opened the feed, which is treated as "everything the
 * partner made is unread" rather than "nothing is".
 */
const memberStateSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    userId: { type: String, required: true },
    lastSeenActivityAt: { type: Date },
  },
  { timestamps: true },
);

// One watermark row per (space, member). Unique so the markSeen upsert can
// never race itself into two rows, and it is the only lookup the feed does.
memberStateSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

export type MemberState = InferSchemaType<typeof memberStateSchema>;

export const MemberStateModel =
  models.MemberState ?? model("MemberState", memberStateSchema);
