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

export type RoadmapPlan = InferSchemaType<typeof roadmapPlanSchema>;

export const RoadmapPlanModel =
  models.RoadmapPlan ?? model("RoadmapPlan", roadmapPlanSchema);
