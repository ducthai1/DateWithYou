import { Schema, model, models, type InferSchemaType } from "mongoose";
import { DISTRICTS, CATEGORIES } from "@/lib/districts-categories";

/**
 * A place on the couple's date map. Scoped to a space; every query must filter
 * by `spaceId` (resolved from session in protectedProcedure).
 */
const locationSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    district: { type: String, enum: DISTRICTS, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
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
    note: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

locationSchema.index({ spaceId: 1, status: 1 });

export type Location = InferSchemaType<typeof locationSchema>;

export const LocationModel = models.Location ?? model("Location", locationSchema);
