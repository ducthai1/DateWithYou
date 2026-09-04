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
     * `status` key; nothing reads it.
     */
    createdBy: { type: String, required: true },
    checklists: [tripChecklistSchema],
  },
  { timestamps: true }
);

// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
tripSchema.index({ spaceId: 1, createdAt: -1 });

export type Trip = InferSchemaType<typeof tripSchema>;
export type TripChecklist = InferSchemaType<typeof tripChecklistSchema>;

export const TripModel = models.Trip ?? model("Trip", tripSchema);
