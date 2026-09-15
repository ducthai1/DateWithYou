import { Schema, model, models, type InferSchemaType } from "mongoose";

const tripChecklistSchema = new Schema({
  content: { type: String, required: true },
  isDone: { type: Boolean, default: false },
  assigneeId: { type: String }, // Optional, who is responsible
});

const tripSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    coverMediaId: { type: String },
    startDate: { type: String, required: true }, // YYYY-MM-DD
    endDate: { type: String, required: true },   // YYYY-MM-DD
    budget: { type: Number, default: 0 },
    /*
     * No `status` field. It is a function of startDate/endDate — see
     * tripStatus() — so storing one only created a second answer that could
     * disagree with the first. Documents written before this keep a stray
     * `status` key.
     *
     * "Nothing reads it" is what this said, and it was false for nine months:
     * `stats.overview` was still matching on it, so the "chuyến đã đi trọn"
     * count silently only ever included pre-refactor rows. If a field is
     * removed, grep the MODEL — the UI having stopped using it proves nothing
     * about the aggregations.
     */
    /*
     * Set only by the day planner: a fingerprint of the plan that was
     * confirmed (the day, and each stop's time and place).
     *
     * It exists so that a flaky connection and a second tap produce one trip
     * rather than two. Confirming a DIFFERENT plan on the same day is a
     * different fingerprint and correctly makes a second trip. Trips created
     * by hand never have one.
     */
    sourceKey: { type: String },
    createdBy: { type: String, required: true },
    checklists: [tripChecklistSchema],
  },
  { timestamps: true }
);

// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
tripSchema.index({ spaceId: 1, createdAt: -1 });
// Partial, not sparse: a sparse COMPOUND index still indexes every hand-made
// trip under a null sourceKey, and the second one collides.
tripSchema.index(
  { spaceId: 1, sourceKey: 1 },
  { unique: true, partialFilterExpression: { sourceKey: { $type: "string" } } },
);

export type Trip = InferSchemaType<typeof tripSchema>;
export type TripChecklist = InferSchemaType<typeof tripChecklistSchema>;

export const TripModel = models.Trip ?? model("Trip", tripSchema);
