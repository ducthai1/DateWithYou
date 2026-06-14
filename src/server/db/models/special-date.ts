import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A meaningful date for the couple (anniversary, birthday, first kiss…). Stored
 * as a `YYYY-MM-DD` key; `recurYearly` events match by month/day every year and
 * drive the in-app countdown + ♥/★ markers on the calendar.
 */
const specialDateSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    recurYearly: { type: Boolean, default: true },
    icon: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

specialDateSchema.index({ spaceId: 1, date: 1 });

export type SpecialDate = InferSchemaType<typeof specialDateSchema>;

export const SpecialDateModel =
  models.SpecialDate ?? model("SpecialDate", specialDateSchema);
