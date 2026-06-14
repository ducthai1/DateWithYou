import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A single itinerary item on one calendar day for a couple space. The day is a
 * `YYYY-MM-DD` string (`date`) rather than a Date so day-bucketing needs no
 * timezone math — see `src/lib/date-keys.ts`. Items are grouped by `bucket`
 * (Sáng/Trưa/Chiều/Tối) and ordered within a bucket by `order`.
 */
const planItemSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    note: { type: String },
    date: { type: String, required: true }, // YYYY-MM-DD (Saigon day key)
    bucket: {
      type: String,
      enum: ["morning", "noon", "afternoon", "evening"],
      required: true,
    },
    time: { type: String }, // optional "HH:mm"
    order: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["planned", "done", "skipped"],
      default: "planned",
    },
    assigneeId: { type: String }, // a member userId; unset = both partners
    locationId: { type: String },
    mediaId: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

planItemSchema.index({ spaceId: 1, date: 1 });

export type PlanItem = InferSchemaType<typeof planItemSchema>;

export const PlanItemModel = models.PlanItem ?? model("PlanItem", planItemSchema);
