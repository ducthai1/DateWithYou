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
    /*
     * The day planner's daily allowance for looking up unknown places.
     *
     * It lives here rather than in a collection of its own for three reasons,
     * and all three are the point: this document is already one-per-space, it
     * is already swept by `delete-space-cascade`, and a counter nobody can
     * find is a counter nobody resets. `placesSearchDate` is the Saigon day
     * key the count belongs to — a different key means the allowance has
     * already rolled over, so no cron is needed to reset it.
     */
    placesSearchDate: { type: String },
    placesSearchCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type LocationConfig = InferSchemaType<typeof locationConfigSchema>;

export const LocationConfigModel =
  models.LocationConfig ?? model("LocationConfig", locationConfigSchema);
