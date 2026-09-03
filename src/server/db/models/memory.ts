import { Schema, model, models, type InferSchemaType } from "mongoose";

const photoSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

// Embedded link media (YouTube/Spotify/TikTok…). Link-only — no file hosting.
const embedSchema = new Schema(
  {
    provider: { type: String, required: true },
    url: { type: String, required: true },
    embedId: { type: String },
    embedUrl: { type: String },
    thumbnailUrl: { type: String },
    title: { type: String },
  },
  { _id: false },
);

/**
 * A dated memory with photos, optionally pinned to a saved location. Scoped to
 * a space; photos live in Cloudinary and are destroyed on update/delete.
 */
const memorySchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    caption: { type: String },
    photos: { type: [photoSchema], default: [] },
    embeds: { type: [embedSchema], default: [] },
    tags: { type: [String], default: [] },
    date: { type: Date, required: true },
    /*
     * Time of day, "HH:mm", optional and separate from `date`.
     *
     * Kept as its own string rather than folded into the Date so every memory
     * saved before this existed stays exactly as it was — no migration, no
     * midnight appearing on entries whose hour nobody recorded.
     */
    time: { type: String },
    locationId: { type: String },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

/*
 * `time` is in the key so the timeline's sort stays index-covered.
 *
 * Two memories on the same day order by the hour beside the date, and without
 * this the tie group is sorted in memory. Harmless at this size, and free to
 * avoid.
 */
memorySchema.index({ spaceId: 1, date: -1, time: -1 });
// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
memorySchema.index({ spaceId: 1, createdAt: -1 });

export type Memory = InferSchemaType<typeof memorySchema>;

export const MemoryModel = models.Memory ?? model("Memory", memorySchema);
