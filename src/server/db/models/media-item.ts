import { Schema, model, models, type InferSchemaType } from "mongoose";

const recipeSchema = new Schema(
  {
    ingredients: { type: [String], default: [] },
    steps: { type: [String], default: [] },
    cookTime: { type: String },
    servings: { type: String },
    coverImage: { type: String },
  },
  { _id: false },
);

/**
 * A saved item in the couple's collection: a song/playlist, a tasty-food video,
 * a recipe, or a game. Link-only (no file hosting) — `url` + parsed embed
 * metadata for music/video; `recipe` carries structured fields. Scoped to a
 * space. Keep `kind` in sync with the router's `kindEnum`.
 */
const mediaItemSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ["music", "food_video", "recipe", "game"],
      required: true,
    },
    title: { type: String, required: true },
    note: { type: String },
    url: { type: String },
    provider: { type: String },
    embedId: { type: String },
    embedUrl: { type: String },
    thumbnailUrl: { type: String },
    tags: { type: [String], default: [] },
    recipe: { type: recipeSchema },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

mediaItemSchema.index({ spaceId: 1, kind: 1, createdAt: -1 });

export type MediaItem = InferSchemaType<typeof mediaItemSchema>;

export const MediaItemModel = models.MediaItem ?? model("MediaItem", mediaItemSchema);
