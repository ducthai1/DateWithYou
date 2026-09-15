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
    openTime: { type: String }, // Format "HH:mm"
    closeTime: { type: String }, // Format "HH:mm"
    // Set when status flips to "visited", cleared back to undefined otherwise —
    // lets the unified calendar pin a visited place to the day it was marked.
    visitedAt: { type: Date },
    note: { type: String },
    /*
     * Where this row came from.
     *
     * "user" is a place one of the two people added by hand and is the only
     * kind the app had until the day planner arrived. "suggested" is a place
     * the planner found through Google and saved because a plan containing it
     * was confirmed — it is the couple's row, in the couple's space, but it is
     * not yet something they chose, so four screens treat it differently
     * (the wheel skips it, the list badges it, the map pins it in another
     * colour, stats count it separately). Pressing "Giữ lại" flips it to
     * "user" and it becomes ordinary.
     *
     * An enum with room to grow: a shared community space is on the roadmap
     * and would add a third value here rather than a parallel field.
     */
    source: {
      type: String,
      enum: ["user", "suggested"],
      default: "user",
      index: true,
    },
    /** Google's 0–4 price scale, when it gave one. Never a currency amount. */
    priceLevel: { type: Number, min: 0, max: 4 },
    /*
     * Google's `place_id`.
     *
     * Kept because it is the one field Google's terms allow to be stored
     * indefinitely — the name, rating and hours that came with it are cached
     * briefly and treated as stale. It is also what makes confirming the same
     * plan twice idempotent: the upsert keys on (spaceId, externalId).
     */
    externalId: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

locationSchema.index({ spaceId: 1, status: 1 });
// Covers list queries that filter by district and/or category (most common filter combo).
locationSchema.index({ spaceId: 1, district: 1, category: 1 });
// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
locationSchema.index({ spaceId: 1, createdAt: -1 });
/*
 * One row per Google place per space: what makes confirming a plan twice (a
 * flaky network, a double tap) create one place rather than two.
 *
 * `partialFilterExpression`, not `sparse`. A sparse COMPOUND index only skips a
 * document when every indexed field is missing — and `spaceId` is always there,
 * so every hand-added row still gets indexed under `externalId: null` and the
 * second one collides. That is not theory: it broke `read-surfaces` the first
 * time this index existed. Restricting the index to rows where externalId is
 * actually a string is the thing that means what "sparse" sounds like it means.
 */
locationSchema.index(
  { spaceId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } },
);
// The four screens that have to tell suggested places apart filter on source
// together with spaceId; this serves those and the 60-day cleanup sweep.
locationSchema.index({ spaceId: 1, source: 1, createdAt: 1 });

export type Location = InferSchemaType<typeof locationSchema>;

export const LocationModel = models.Location ?? model("Location", locationSchema);
