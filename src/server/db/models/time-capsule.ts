import { Schema, model, models, type InferSchemaType } from "mongoose";

const timeCapsuleSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    creatorId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true },
    mediaUrls: { type: [String], default: [] },
    unlockDate: { type: Date, required: true },
    isOpened: { type: Boolean, default: false },
  },
  { timestamps: true },
);

timeCapsuleSchema.index({ spaceId: 1, unlockDate: 1 });
// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
timeCapsuleSchema.index({ spaceId: 1, createdAt: -1 });

export type TimeCapsule = InferSchemaType<typeof timeCapsuleSchema>;

export const TimeCapsuleModel =
  models.TimeCapsule ?? model("TimeCapsule", timeCapsuleSchema);
