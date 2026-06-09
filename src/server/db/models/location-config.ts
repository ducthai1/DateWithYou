import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Stores the customizable lists of categories and districts for a specific space.
 * This replaces the old hardcoded enums in districts-categories.ts.
 */
const locationConfigSchema = new Schema(
  {
    spaceId: { type: String, required: true, unique: true },
    categories: { type: [String], required: true },
    districts: { type: [String], required: true },
  },
  { timestamps: true },
);

export type LocationConfig = InferSchemaType<typeof locationConfigSchema>;

export const LocationConfigModel =
  models.LocationConfig ?? model("LocationConfig", locationConfigSchema);
