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
     * "upcoming" is kept only so documents written before the rename still
     * validate if they are saved again; nothing produces it any more and the
     * read path folds it into "planning" (see normaliseTripStatus). Removing it
     * from the enum would make an old trip unsaveable rather than just renamed.
     */
    status: {
      type: String,
      enum: ["planning", "active", "completed", "upcoming"],
      default: "planning",
    },
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
