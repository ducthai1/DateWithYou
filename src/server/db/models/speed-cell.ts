import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Metres and seconds this couple has ridden in one ~440 m square at one hour
 * of a weekday or weekend day — their own traffic data. See src/lib/speed-profile.ts.
 */
const speedCellSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    cell: { type: String, required: true },
    bucket: { type: String, required: true },
    m: { type: Number, default: 0 },
    s: { type: Number, default: 0 },
  },
  { versionKey: false },
);

speedCellSchema.index({ spaceId: 1, cell: 1, bucket: 1 }, { unique: true });

export type SpeedCell = InferSchemaType<typeof speedCellSchema>;

export const SpeedCellModel = models.SpeedCell ?? model("SpeedCell", speedCellSchema);
