import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Answers from the places provider, kept for a few hours.
 *
 * The cache this replaces was a `Map` in module scope, and on Vercel that is
 * very nearly useless: every request may land on a fresh instance, so the map
 * is usually empty and the allowance gets spent on questions already answered.
 * The daily counter survived because it was always in Mongo; the cache did not,
 * because it never left the process.
 *
 * **Not scoped to a space, on purpose.** "Cafés near this corner today" has the
 * same answer for everybody, so one couple's search spares the next one's
 * allowance. That also means it holds no private data — the key is a rounded
 * coordinate and a kind of place, never who asked. Which is why it is absent
 * from `delete-space-cascade`: there is nothing in here belonging to a space.
 *
 * Only OSM-derived answers are stored. Google's terms allow keeping the place
 * id indefinitely but not the rest, so that provider keeps its short in-memory
 * cache and nothing here.
 */
const placeSearchCacheSchema = new Schema(
  {
    /** provider · kind · rounded cell · day. Built by the caller. */
    key: { type: String, required: true, unique: true },
    places: { type: Schema.Types.Mixed, required: true },
    /** Mongo deletes the row itself once this passes. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// A TTL index: the sweeping is the database's job, not a cron's.
placeSearchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PlaceSearchCache = InferSchemaType<typeof placeSearchCacheSchema>;

export const PlaceSearchCacheModel =
  models.PlaceSearchCache ?? model("PlaceSearchCache", placeSearchCacheSchema);
