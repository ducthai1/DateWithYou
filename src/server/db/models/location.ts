import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A place on the couple's date map. Scoped to a space; every query must filter
 * by `spaceId` (resolved from session in protectedProcedure).
 */
const locationSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    district: { type: String, required: true },
    category: { type: String, required: true },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    googleMapsUrl: { type: String },
    socialUrl: { type: String },
    mustTry: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    status: {
      type: String,
      enum: ["want_to_go", "visited"],
      default: "want_to_go",
    },
    // Set when status flips to "visited", cleared back to undefined otherwise —
    // lets the unified calendar pin a visited place to the day it was marked.
    visitedAt: { type: Date },
    note: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

locationSchema.index({ spaceId: 1, status: 1 });

export type Location = InferSchemaType<typeof locationSchema>;

export const LocationModel = models.Location ?? model("Location", locationSchema);
