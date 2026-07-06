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
    status: {
      type: String,
      enum: ["planning", "upcoming", "completed"],
      default: "planning",
    },
    createdBy: { type: String, required: true },
    checklists: [tripChecklistSchema],
  },
  { timestamps: true }
);

export type Trip = InferSchemaType<typeof tripSchema>;
export type TripChecklist = InferSchemaType<typeof tripChecklistSchema>;

export const TripModel = models.Trip ?? model("Trip", tripSchema);
