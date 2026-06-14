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
    locationId: { type: String },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

memorySchema.index({ spaceId: 1, date: -1 });

export type Memory = InferSchemaType<typeof memorySchema>;

export const MemoryModel = models.Memory ?? model("Memory", memorySchema);
