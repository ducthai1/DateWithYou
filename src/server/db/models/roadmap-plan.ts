import { Schema, model, models, type InferSchemaType } from "mongoose";

/** Future plans / bucket list for the couple. Status flows idea → planning → done. */
const roadmapPlanSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    targetDate: { type: Date },
    status: {
      type: String,
      enum: ["idea", "planning", "done"],
      default: "idea",
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
roadmapPlanSchema.index({ spaceId: 1, createdAt: -1 });

export type RoadmapPlan = InferSchemaType<typeof roadmapPlanSchema>;

export const RoadmapPlanModel =
  models.RoadmapPlan ?? model("RoadmapPlan", roadmapPlanSchema);
